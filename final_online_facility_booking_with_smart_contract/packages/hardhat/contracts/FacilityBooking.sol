//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
pragma experimental ABIEncoderV2; // required to return struct(BookingData) data on getBookingData function

import "hardhat/console.sol"; // to output log in hardhat. Delete this when deploying to production
import "@openzeppelin/contracts/access/Ownable.sol"; // Use Openzeppelin's Ownable contract

/** 
 * @title FacilityBooking
 * @dev Online facility booking smart contract
 */
contract FacilityBooking is Ownable {
    
    /*
      Parameters
    */
    string building_name = "Riverside Residence";
    string[] facilities = ["tennis"]; // For now, just handle a facility
    uint[] fees = [0.001 ether]; // Fees per slot. Must be as same as the frontend fee setting

    /*
      Structs
    */
    // Representation of each booking data 
    struct BookingData {
        uint bookingStart;
        uint bookingEnd;
        address resident;
        uint bookingFee;
    }

    // Representation of each facility
    struct FacilityInfo {
        BookingData[] bookingData; // FacilityInfo contains an array of booking data
        bool isValid;
        uint fee;
    }
    
    /*
      Mappings
     */
    mapping(string => FacilityInfo) facilityData; // contains all booking data by facility name
    mapping(address => uint) refunds; // keeps resident's fees for canceled bookings

    /*
      Events
     */
    // Emit when new booking request is added
    event NewBooking(string facility, address resident, uint start, uint end);
    // Emit when an existing booking request is cancled
    event CancelBooking(string facility, address resident, uint start, uint end, bool byAdmin);
    // Emit when owen withdraw the contract balance
    event Withdrawal(address admin, uint amount);

    /*
      Errors 
     */
    /// Wrong Fee. Needed `required` but sent `fee`
    /// @param facility facility name
    /// @param resident resident's wallet address
    /// @param start    start time of booking slot
    /// @param end      end time of booking slot
    /// @param fee      sent fee amount
    /// @param required required fee amount 
    error WrongFee(string facility, address resident, uint start, uint end, uint fee, uint required);

    /// The time slot from `start` to `end` is taken
    /// @param facility facility name
    /// @param resident resident's wallet address
    /// @param start    start time of booking slot
    /// @param end      end time of booking slot
    error AlreadyTaken(string facility, address resident, uint start, uint end);

    /*
      Modifier
     */
    // Check if facility exist in this contract
    modifier isExist(string memory _facility) {
        require(facilityData[_facility].isValid == true, "The facility does not exist");
        _;
    }

    constructor() {
        // initialize the facility information using the parameters. For now, only tennis is set.
        for (uint i = 0; i < facilities.length; i++) {
           facilityData[facilities[i]].isValid = true; 
           facilityData[facilities[i]].fee = fees[i]; 
        }
    }
    
    /** 
     * @dev register a booking request
     * @param _start    time of booking slot
     * @param _end      end time of booking slot
     * @param _facility facility name
     */  
    function register(uint _start, uint _end, string calldata _facility) 
        isExist(_facility)
        external 
        payable 
        returns (bool)
        {
            if (owner() != msg.sender) { // owner does not need to pay fee because she is supposed to receive fee in other way(i.e., cash payment)
                uint thirtyMinsInMsec = 30 * 60 * 1000; // 30 mins in millisecond. the current time slot length is 30 min.
                uint numOfSlots = (_end - _start) / thirtyMinsInMsec; // calculate the number of slots from booking start to end time passed in millisecond
                uint required = facilityData[_facility].fee * numOfSlots;
                if (msg.value != required)
                    revert WrongFee(_facility, msg.sender, _start, _end, msg.value, required);
            } 

            uint current = block.timestamp;
            if (current > _start || isBooked(_start, _end, _facility) == true) {
                revert AlreadyTaken(_facility, msg.sender, _start, _end);
            } else {
                facilityData[_facility].bookingData.push(
                    BookingData({
                        bookingStart: _start,
                        bookingEnd:   _end,
                        resident: msg.sender,
                        bookingFee: msg.value
                    })
                );
                emit NewBooking(_facility , msg.sender, _start, _end);
                return true;
            }
        }

    /** 
     * @dev check if new booking slot is already take
     * @param _start    time of booking slot
     * @param _end      end time of booking slot
     * @param _facility facility name
     */  
    function isBooked(uint _start, uint _end, string calldata _facility) 
        private
        view
        returns(bool)
        {
            for (uint i = 0; i < facilityData[_facility].bookingData.length; i++) {
                if (_start < facilityData[_facility].bookingData[i].bookingEnd &&
                    _end > facilityData[_facility].bookingData[i].bookingStart) {
                        return true;
                    }
            }
            return false;
        }
    
    /** 
     * @dev return all booking data of the facility
     * @param _facility facility name
     */  
    function getBookingData(string calldata _facility) isExist(_facility) external view returns (BookingData[] memory) {
        return facilityData[_facility].bookingData;
    }
    
    /** 
     * @dev cancel an existing booking
     * @param _start    time of booking slot
     * @param _end      end time of booking slot
     * @param _facility facility name
     */  
    function cancelBooking(uint _start, uint _end, string calldata _facility) isExist(_facility) external returns (bool) {
        address owner = owner();
        bool isOwner = owner == msg.sender;
        for (uint i = 0; i < facilityData[_facility].bookingData.length; i++) {
            if (!isOwner) { // owner is allowed to cancel any booking
                // Check if the sender and booker are the same
                if (facilityData[_facility].bookingData[i].resident != msg.sender) {
                    continue;
                }
            }

            // If the sender and booker are the same, find the corresponding booking slot
            if (_start == facilityData[_facility].bookingData[i].bookingStart &&
                _end == facilityData[_facility].bookingData[i].bookingEnd) {
                    address resident = facilityData[_facility].bookingData[i].resident;
                    uint bookingFee = facilityData[_facility].bookingData[i].bookingFee;
                    delete facilityData[_facility].bookingData[i];
                    // Follow the best practice "Favor pull over push for external calls"
                    // Thus, do not refund in this function.
                    // https://consensys.github.io/smart-contract-best-practices/recommendations/#favor-pull-over-push-for-external-calls 
                    if (resident != address(0)) {
                        refunds[resident] += bookingFee;
                    }
                    emit CancelBooking(_facility , resident, _start, _end, isOwner);
                    return true;
                }
        }
        return false;
    }

    /** 
     * @dev transfer the resident's booking fee for cancel slots
     */  
    function refund() external {
        // Checks-Effects-Interactions Pattern to prevent Reentrancy Attacks
        // https://docs.soliditylang.org/en/develop/security-considerations.html?highlight=check%20effects#use-the-checks-effects-interactions-pattern
        uint amount = refunds[msg.sender];
        require(amount > 0, "You have no refund");
        require(amount < address(this).balance, "Please try it later. Not enough balance available to return your fund");
        refunds[msg.sender] = 0; 

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed to send the amount");
    }

    /** 
     * @dev return the amount of a resident's booking fee for canceled slots
     * @param _resident resident wallet address
     */  
    function getRefundAmount(address _resident) external view returns (uint){
        return refunds[_resident];
    }

    /** 
     * @dev return facility name
     */  
    function getFacilityNames() external view returns (string memory){
        return facilities[0]; // temporally return the first facility name
    }

    /** 
     * @dev return building name
     */  
    function getBuildingName() external view returns (string memory){
        return building_name;
    }

    /** 
     * @dev return fee of the facility
     * @param _facility facility name
     */  
    function getFees(string calldata _facility) external view returns (uint){
        return facilityData[_facility].fee;
    }

    /** 
     * @dev return owner
     */  
    function getOwner() external view returns (address){
        return owner();
    }

    /** 
     * @dev return contract balance
     */  
    function getBalance() external onlyOwner view returns (uint){
        return address(this).balance;
    }

    /** 
     * @dev to receive Ether. msg.data must be empty
     */  
    receive() external payable {}

    /** 
     * @dev withdraw all balance of this contract
     */  
    function withdraw() onlyOwner external {
        require(address(this).balance > 0, "Not enough balance available to return your fund");
        address owner = owner();
        uint amount = address(this).balance;

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Failed to send the amount");
        emit Withdrawal(owner, amount);
    }
}
