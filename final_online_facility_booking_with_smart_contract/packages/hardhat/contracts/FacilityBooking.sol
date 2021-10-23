//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/** 
 * @title FacilityBooking
 * @dev 
 */
contract FacilityBooking is Ownable {
    
    // address service_provider = "";
    string building_name = "Riverside Residence";
    
    string[] facilities = ["tennis"];
    uint[] fees = [1000];

    struct BookingData {
        uint bookingStart;
        uint bookingEnd;
        address resident;
        uint bookingFee;
    }

    struct FacilityInfo {
        BookingData[] bookingData;
        bool isValid;
        uint fee;
    }
    
    mapping(string => FacilityInfo) facilityData;
    mapping(address => uint) refunds;

    event NewBooking(string facility, address resident, uint start, uint end);
    event CancelBooking(string facility, address resident, uint start, uint end, bool byAdmin);
    event Withdrawal(address admin, uint amount);
    error WrongFee(string facility, address resident, uint start, uint end, uint fee, uint required);
    error AlreadyTaken(string facility, address resident, uint start, uint end);

    modifier isExist(string memory _facility) {
        require(facilityData[_facility].isValid == true, "The facility does not exist");
        _;
    }

    constructor() {
        for (uint i = 0; i < facilities.length; i++) {
           facilityData[facilities[i]].isValid = true; 
           facilityData[facilities[i]].fee = fees[i]; 
        }
    }
    
    function register(uint _start, uint _end, string calldata _facility) 
        isExist(_facility)
        external 
        payable 
        returns (bool)
        {
            if (owner() != msg.sender) {
                uint diff = (_end - _start) / (30 * 60 * 1000);
                uint required = facilityData[_facility].fee * diff;
                if (msg.value != required)
                    revert WrongFee(_facility, msg.sender, _start, _end, msg.value, facilityData[_facility].fee * diff);
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
    
    function getBookingData(string calldata _facility) isExist(_facility) external view returns (BookingData[] memory) {
        return facilityData[_facility].bookingData;
    }
    
    function cancelBooking(uint _start, uint _end, string calldata _facility) isExist(_facility) external returns (bool) {
        address owner = owner();
        bool isOwner = owner == msg.sender;
        for (uint i = 0; i < facilityData[_facility].bookingData.length; i++) {
            if (!isOwner) {
                if (facilityData[_facility].bookingData[i].resident != msg.sender) {
                    continue;
                }
            }

            if (_start == facilityData[_facility].bookingData[i].bookingStart &&
                _end == facilityData[_facility].bookingData[i].bookingEnd) {
                    address resident = facilityData[_facility].bookingData[i].resident;
                    uint bookingFee = facilityData[_facility].bookingData[i].bookingFee;
                    delete facilityData[_facility].bookingData[i];
                    // Favor pull over push for external calls
                    if (resident != address(0)) {
                        refunds[resident] += bookingFee;
                    }
                    emit CancelBooking(_facility , resident, _start, _end, isOwner);
                    return true;
                }
        }
        return false;
    }

    // Checks-Effects-Interactions Pattern
    function refund() external {
        uint amount = refunds[msg.sender];
        require(amount > 0, "You have no refund");
        require(amount < address(this).balance, "Please try it later. Not enough balance available to return your fund");
        refunds[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Failed to send the amount");
    }

    function getFacilityNames() external view returns (string memory){
        return facilities[0];
    }

    function getBuildingName() external view returns (string memory){
        return building_name;
    }

    function getOwner() external view returns (address){
        return owner();
    }

    function getBalance() external onlyOwner view returns (uint){
        return address(this).balance;
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    function withdraw() onlyOwner external {
        require(address(this).balance > 0, "Not enough balance available to return your fund");
        address owner = owner();
        uint amount = address(this).balance;

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Failed to send the amount");
        emit Withdrawal(owner, amount);
    }
}
