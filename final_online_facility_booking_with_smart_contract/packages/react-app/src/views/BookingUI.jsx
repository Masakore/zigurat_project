import { utils } from "ethers";
import { Button, Divider, List, Tabs } from "antd";
import React, { useState, useEffect } from "react";
import moment from "moment";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

export default function BookingUI({
  buildingName,
  facilityName,
  setNewBookingEvents,
  setCancelBookingEvents,
  address,
  tx,
  readContracts,
  writeContracts,
  fees,
}) {
  /*
    States
  */
  const { TabPane } = Tabs;
  const defaultTime = new Date().setHours(9, 0);
  const [startDate, setStartDate] = useState(defaultTime);
  const [bookingStartDisplay, setBookingStartDisplay] = useState(defaultTime);
  const [bookingEndDisplay, setBookingEndDisplay] = useState(defaultTime);
  const [newBookingStart, setNewBookingStart] = useState(new Date(defaultTime).getTime());
  const [newBookingEnd, setNewBookingEnd] = useState(new Date(defaultTime).getTime());
  const [endTimeExceedStartError, setEndTimeExceedStartError] = useState(false);
  const [oldDateSelectedError, setOldDateSelectedError] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0.0);

  const dateToTime = new Map(); // Used to identify booked slots on the calendar
  const addressToBooking = new Map(); // Used to identify upcoing bookings

  /*
    Functions
  */
  // Set all booking slots in dateToTime
  // and allUpcomingBooking from NewBookingEvents
  const refreshUpcomingBooking = () => setNewBookingEvents.map(item => {
    const bookerAddress = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);
    if (!dateToTime.has(date)) {
      dateToTime.set(date, [[start, end]]);
    } else {
      let existingDates = dateToTime.get(date);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      dateToTime.set(date, [...existingDates, [start, end]]);
    }

    if (bookerAddress != address) {
      return;
    }

    if (!addressToBooking.has(bookerAddress)) {
      addressToBooking.set(bookerAddress, [[start, end]]);
    } else {
      let existingDates = addressToBooking.get(bookerAddress);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      addressToBooking.set(bookerAddress, [...existingDates, [start, end]]);
    }
  });
  refreshUpcomingBooking();

  // Remove canceled booking from dateToTime and allUpcomingBooking variables
  const refrechCanceledBooking = () => setCancelBookingEvents.map(item => {
    const bookerAddress = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);

    if (dateToTime.has(date)) {
      let existingDates = dateToTime.get(date);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      dateToTime.set(date, [...existingDates]);
    }

    if (bookerAddress != address) {
      return;
    }

    if (addressToBooking.has(bookerAddress)) {
      let existingDates = addressToBooking.get(bookerAddress);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start))
      addressToBooking.set(bookerAddress, [...existingDates]);
    }
  });
  refrechCanceledBooking();

  const getRefundAmount = async () => {
    if (readContracts.FacilityBooking) {
      let result = await readContracts.FacilityBooking.getRefundAmount(address);
      const etherBalance = utils.formatEther(result);
      parseFloat(etherBalance).toFixed(2);
      const floatBalance = parseFloat(etherBalance);

      setRefundAmount(floatBalance);
    }
    return 0;
  }

  // Filter unavailable days
  const filterPassedDate = time => {
    const day = moment(time).day();
    return day !== 0 && day !== 6;
  };

  // Filter unavailable times
  const currentTime = new Date();
  const filterPassedTime = time => {
    if (!filterPassedDate(time)) {
      return false;
    }
    if (time < currentTime) {
      return false;
    }
    const start = new Date(time).setHours(9, 0, 0);
    const end = new Date(time).setHours(22, 0, 0);
    if (time < start || end < time) {
      return false;
    }

    const date = moment(time).format("YYYYMMDD");
    const selectedTimestamp = time.getTime();
  
    if (dateToTime.has(date)) {
      const result = dateToTime.get(date).filter(item => {
        return item[0] <=  selectedTimestamp  && selectedTimestamp < item[1];
      });
      return result.length > 0 ? false : true;
    }
    return true;
  };

  /*
    Update State 
  */
  // Refresh the refundable amount of the current user
  useEffect(async () => {
    getRefundAmount();
  }, [setNewBookingEvents, setCancelBookingEvents]);

  /*
    Error messages 
  */
  const EndTimeExceedStartError = () => (
    <p style={{ color: "red" }}>The start time cannot exceed the end time!</p>
  )

  const OldDateSelectedError = () => (
    <p style={{color: "red"}}>You chose a wrong pair of the start and the end slot. Booking time must be future!</p>
  );

  /*
    Structure
  */
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 600, margin: "auto", marginTop: 64 }}>
        <h2>{buildingName}</h2>
        <div style={{ fontSize: 20 }}>Facility: {facilityName}</div>
        <div style={{ fontSize: 15 }}>booking fee per slot: {fees} ETH</div>
        <Divider />
        <h2>Select date and time</h2>
        <div>
          <DatePicker
            inline
            selected={startDate}
            minDate={defaultTime}
            filterDate={filterPassedDate}
            onChange={date => {
              setOldDateSelectedError(false);
              setStartDate(date);
              const start = new Date(date).setHours(9, 0, 0);
              const end = new Date(date).setHours(9, 30, 0);
              setBookingStartDisplay(start);
              setBookingEndDisplay(end);
              setNewBookingStart(new Date(start).getTime());
              setNewBookingEnd(new Date(end).getTime());
            }}
            dateFormat="yyyy-MM-dd hh:mm"
            shouldCloseOnSelect={false}
          >
            <div style={{ color: "grey" }}>**Gray color are not avaiable**</div>
          </DatePicker>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
          <div>
            <div>
              Start
            </div>
            <div>
              <DatePicker
                selected={bookingStartDisplay}
                showTimeSelect
                showTimeSelectOnly
                filterTime={filterPassedTime}
                timeIntervals={30}
                onChange={date => {
                  setOldDateSelectedError(false);
                  setBookingStartDisplay(date);
                  setNewBookingStart(new Date(date).getTime());
                }}
                dateFormat="hh:mm aa"
              />
            </div>
          </div>
          <div style={{marginLeft: 5}}>
            <div>
              End
            </div>
            <div>
              <DatePicker
                selected={bookingEndDisplay}
                showTimeSelect
                showTimeSelectOnly
                filterTime={filterPassedTime}
                timeIntervals={30}
                onChange={date => {
                  setOldDateSelectedError(false);
                  setBookingEndDisplay(date);
                  setNewBookingEnd(new Date(date).getTime());
                }}
                dateFormat="hh:mm aa"
              />
            </div>
          </div>
        </div>
        <div>
          { endTimeExceedStartError ? <EndTimeExceedStartError/> : null }
          { oldDateSelectedError ? <OldDateSelectedError/> : null }
        </div>
        <div style={{ margin: 8 }}>
          <Button
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (bookingStartDisplay < currentTime || bookingEndDisplay < currentTime) {
                setOldDateSelectedError(true);
                return;
              }
              if (bookingStartDisplay >= bookingEndDisplay) {
                setEndTimeExceedStartError(true);
                return;
              }
              setOldDateSelectedError(false);
              setEndTimeExceedStartError(false);

              // Here's booking fee calculatioon logic
              // calculate the number of slots from start to end time which are passed in millisecond
              const thirtyMinsInMsec =  30 * 60 * 1000;
              const numOfSlots = (newBookingEnd - newBookingStart) / thirtyMinsInMsec; // end, start time passed in millisecond
              const feePerSlot = 1000000000000000; // in wei(~=0.001 ether)
              const fee = numOfSlots * feePerSlot;
              const result = tx(
                writeContracts.FacilityBooking.register(newBookingStart, newBookingEnd, "tennis", {
                  value: fee,
                }),
                update => {
                console.log("📡 Transaction Update:", update);
                if (update && (update.status === "confirmed" || update.status === 1)) {
                    console.log(" 🍾 Transaction " + update.hash + " finished!");
                    console.log(
                      " ⛽️ " +
                        update.gasUsed +
                        "/" +
                      (update.gasLimit || update.gas) +
                        " @ " +
                        parseFloat(update.gasPrice) / 1000000000 +
                      " gwei",
                    );
                  }
                },
              );
              console.log("awaiting metamask/web3 confirm result...", await result);
            }}
          >
            Book
          </Button>
        </div>
      </div>

      <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
        <Tabs defaultActiveKey="1" type="card" size="small">
            <TabPane tab="Upcoming" key="1">
              <h2>Your Upcoming Booking</h2>
              <List
                bordered
                dataSource={addressToBooking.get(address)}
                renderItem={date_time => {
                  if (date_time[0] < new Date().getTime()) {
                    return;
                  }
                  const start = moment(date_time[0]).format("YYYY/MM/DD ddd hh:mm a");
                  const end = moment(date_time[1]).format("hh:mm a");
                  return (
                    <List.Item>
                      {start} - {end}
                      <Button
                        style={{ marginLeft: 10}}
                        onClick={async () => {
                          const result = tx(writeContracts.FacilityBooking.cancelBooking(date_time[0], date_time[1], "tennis"), 
                            update => {
                            console.log("📡 Transaction Update:", update);
                            if (update && (update.status === "confirmed" || update.status === 1)) {
                                console.log(" 🍾 Transaction " + update.hash + " finished!");
                                console.log(
                                  " ⛽️ " +
                                    update.gasUsed +
                                    "/" +
                                  (update.gasLimit || update.gas) +
                                    " @ " +
                                    parseFloat(update.gasPrice) / 1000000000 +
                                  " gwei",
                                );
                              }
                            },
                          );
                          console.log("CANCEL awaiting metamask/web3 confirm result...", await result);
                        }}
                      >Cancel</Button>
                    </List.Item>
                  );
                }}
              />
            </TabPane>
            <TabPane tab="Refund" key="2">
              <h2>Refund Your Canceled Booking Fee</h2>
              <div>Total amount: {refundAmount} ETH</div>
              <div style={{ margin: 8 }}>
                <Button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const result = tx(writeContracts.FacilityBooking.refund(), update => {
                      console.log("📡 Transaction Update:", update);
                      if (update && (update.status === "confirmed" || update.status === 1)) {
                        console.log(" 🍾 Transaction " + update.hash + " finished!");
                        console.log(
                          " ⛽️ " +
                            update.gasUsed +
                            "/" +
                            (update.gasLimit || update.gas) +
                            " @ " +
                            parseFloat(update.gasPrice) / 1000000000 +
                            " gwei",
                        );
                      }
                    });
                    console.log("Transfer ownership, awaiting metamask/web3 confirm result...", await result);
                  }}
                  >
                  Refund 
                </Button>
              </div>
            </TabPane>
            <TabPane tab="History" key="3">
              <h2>History</h2>
              <List
                bordered
                dataSource={addressToBooking.get(address)}
                renderItem={date_time => {
                  const start = moment(date_time[0]).format("YYYY/MM/DD ddd hh:mm a");
                  const end = moment(date_time[1]).format("hh:mm a");
                  return (
                    <List.Item>
                      {start} - {end}
                    </List.Item>
                  );
                }}
              />
            </TabPane>
          </Tabs>
      </div>
    </div>
  );
}
