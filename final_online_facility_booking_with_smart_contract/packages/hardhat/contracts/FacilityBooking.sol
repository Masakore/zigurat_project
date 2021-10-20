//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
/** 
 * @title FacilityBooking
 * @dev 
 */
contract FacilityBooking {
    
    address owner;
    string name;
    uint bookingFees;
    
    string[] facilities = ["tennis"];
    uint[] fees = [1000];

    struct BookingData {
        uint bookingStart;
        uint bookingEnd;
        address resident;
    }

    struct FacilityInfo {
        BookingData[] bookingData;
        bool isValid;
        uint fee;
    }
    
    mapping(string => FacilityInfo) facilityData;

    event NewBooking(string facility, address resident, uint start, uint end);
    event CancelBooking(string facility, address resident, uint start, uint end);
    error WrongFee(string facility, address resident, uint start, uint end, uint fee, uint required);
    error AlreadyTaken(string facility, address resident, uint start, uint end);
    
    modifier isOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    modifier isExist(string memory _facility) {
        require(facilityData[_facility].isValid == true, "The facility does not exist");
        _;
    }

    constructor() {
        for (uint i = 0; i < facilities.length; i++) {
           facilityData[facilities[i]].isValid = true; 
           facilityData[facilities[i]].fee = fees[i]; 
        }
        owner = msg.sender;
    }
    
    function register(uint _start, uint _end, string calldata _facility) 
        isExist(_facility)
        external 
        payable 
        returns (bool)
        {
            uint diff = (_end - _start) / (30 * 60 * 1000);
            uint required = facilityData[_facility].fee * diff;
            if (msg.value != required)
                revert WrongFee(_facility, msg.sender, _start, _end, msg.value, facilityData[_facility].fee * diff);

            uint current = block.timestamp;
            if (current > _start || isBooked(_start, _end, _facility) == true) {
                revert AlreadyTaken(_facility, msg.sender, _start, _end);
            } else {
                facilityData[_facility].bookingData.push(
                    BookingData({
                        bookingStart: _start,
                        bookingEnd:   _end,
                        resident: msg.sender
                    })
                );
                bookingFees += msg.value;
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
        for (uint i = 0; i < facilityData[_facility].bookingData.length; i++) {
            if (facilityData[_facility].bookingData[i].resident != msg.sender) {
                console.log("=====not the resident========:",msg.sender);
                continue;
            }

            console.log("=====cancel start time========:",_start);
            console.log("=====cancel end time========:",_end);
            console.log("=====registered start time========:",facilityData[_facility].bookingData[i].bookingStart);
            console.log("=====registered cancel time========:",facilityData[_facility].bookingData[i].bookingEnd);
            if (_start == facilityData[_facility].bookingData[i].bookingStart &&
                _end == facilityData[_facility].bookingData[i].bookingEnd) {
                    delete facilityData[_facility].bookingData[i];
                    emit CancelBooking(_facility , msg.sender, _start, _end);
                    return true;
                }
        }
        return false;
    }

    function withdraw() external payable isOwner {
        uint withdrawingAmount = bookingFees;
        bookingFees = 0;
        payable(msg.sender).transfer(withdrawingAmount);
    }
}
