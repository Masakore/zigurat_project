import { Button, Divider, Input, List, Tabs } from "antd";
import React, { useState, useEffect, useContext } from "react";
import { Address, Balance } from "../components";
import moment from "moment";
import DatePicker from "react-datepicker";
import { OwnerContext } from "../App";

import "react-datepicker/dist/react-datepicker.css";

// This view provide admin features
export default function AdminUI({
  buildingName,
  facilityName,
  setNewBookingEvents,
  setCancelBookingEvents,
  address,
  localProvider,
  price,
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
  const { owner, setOwner } = useContext(OwnerContext);
  const [newOwner, setNewOwner] = useState();
  const [latestBalance, setLatestBalance] = useState("0");
  const [history, setHistory] = useState([]);

  const dateToTime = new Map(); // Used to identify booked slots on the calendar
  let allUpcomingBooking = []; // Used to identify upcoing bookings
  const currentTime = new Date();

  /*
    Functions
  */
  // Set all booking slots in dateToTime
  // and allUpcomingBooking from NewBookingEvents
  const refreshUpcomingBooking = () => setNewBookingEvents.map((item, index) => {
    const address = item.args[1];
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

    if (start < currentTime) {
      return;
    }

    let filtered = allUpcomingBooking.filter(time => !(time[1] == end && time[0] == start));
    allUpcomingBooking = [...filtered, [start, end, address]];
  });
  refreshUpcomingBooking();

  // Remove canceled booking from dateToTime and allUpcomingBooking variables
  const refrechCanceledBooking = () => setCancelBookingEvents.map(item => {
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);

    if (dateToTime.has(date)) {
      let existingDates = dateToTime.get(date);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      dateToTime.set(date, [...existingDates]);
    }
    
    if (start < currentTime) {
      return;
    }

    allUpcomingBooking = allUpcomingBooking.filter(time => !(time[0] < end && time[1] > start));
  });
  refrechCanceledBooking();

  const refreshBalance = async () => {
    if (owner && owner == address && writeContracts.FacilityBooking) {
      const response = await writeContracts.FacilityBooking.getBalance();
      setLatestBalance(BigInt(response._hex));
    }
  }

  // Fetch all booking information excluding canceled ones
  const getBookingData = async () => {
    if (readContracts.FacilityBooking) {
      let result = await readContracts.FacilityBooking.getBookingData("tennis");
      return result;
    }
    return [];
  };

  // Filter unavailable days
  const filterPassedDate = (time) => {
    const day = moment(time).day();
    return day !== 0 && day !== 6;
  };

  // Filter unavailable times
  const current = new Date();
  const filterPassedTime = time => {
    if (!filterPassedDate(time)) {
      return false;
    }
    if (time < current) {
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
  // Refresh the account balance at new booking or booking cancelation
  useEffect(async () => {
    refreshBalance();
  }, [setNewBookingEvents, setCancelBookingEvents]);

  /*
    Error messages 
  */
  const EndTimeExceedStartError = () => (
    <p style={{ color: "red" }}>The start time cannot exceed the end time!</p>
  )

  const OldDateSelectedError = () => (
    <p style={{color: "red"}}>You chose a wrong pair of the start and the end slot. Booking time must be future!</p>
  )

  /*
    Structure
  */
  // If the current user is admin, then show below.
  const contractDisplay = (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 600, margin: "auto", marginTop: 64 }}>
        <h2>{buildingName}</h2>
        <div style={{ fontSize: 20 }}>Facility: {facilityName}</div>
        <div style={{ fontSize: 15 }}>booking fee per slot: {fees} ETH</div>
        <Divider />
        <div>
          <div>
            Contract Address:
            <Address
              address={readContracts && readContracts.FacilityBooking ? readContracts.FacilityBooking.address : null}
              fontSize={16}
            />
          </div>
          <div>
            Balance:
            <Balance address={readContracts && readContracts.FacilityBooking ? readContracts.FacilityBooking.address : null} provider={localProvider} dollarMultiplier={price} />
          </div>
        </div>
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
          <div style={{ marginLeft: 5 }}>
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

              const result = tx(
                writeContracts.FacilityBooking.register(newBookingStart, newBookingEnd, "tennis", {
                  value: 0, // Booking fee is not required because admin personel is supposed to collect booking fees in some way
                }),
                update => {
                console.log("???? Transaction Update:", update);
                if (update && (update.status === "confirmed" || update.status === 1)) {
                    console.log(" ???? Transaction " + update.hash + " finished!");
                    console.log(
                      " ?????? " +
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
              console.log("New Book, awaiting metamask/web3 confirm result...", await result);
            }}
          >
            Book
          </Button>
        </div>
      </div>

      <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
        <Tabs defaultActiveKey="1" type="card" size="small">
            <TabPane tab="Upcoming" key="1">
              <h2>Upcoming Booking</h2>
              <List
                bordered
                dataSource={allUpcomingBooking}
                renderItem={date_time => {
                  const start = moment(date_time[0]).format("YYYY/MM/DD ddd hh:mm a");
                  const end = moment(date_time[1]).format("hh:mm a");
                  return (
                    <List.Item>
                      {start} - {end} {", Resident: " + date_time[2]}
                      <Button
                        style={{ marginLeft: 10 }}
                        onClick={async () => {
                          const result = tx(writeContracts.FacilityBooking.cancelBooking(date_time[0], date_time[1], "tennis"), 
                            update => {
                            console.log("???? Transaction Update:", update);
                            if (update && (update.status === "confirmed" || update.status === 1)) {
                                console.log(" ???? Transaction " + update.hash + " finished!");
                                console.log(
                                  " ?????? " +
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
                          console.log("Admin Cancel, awaiting metamask/web3 confirm result...", await result);
                        }}
                      >Cancel</Button>
                    </List.Item>
                  );
                }}
              />
            </TabPane>
            <TabPane tab="ChangeAdminAddress" key="2">
              <h2>Change Admin Address</h2>
              <div style={{ margin: 8 }}>
                <Input
                  onChange={e => {
                    setNewOwner(e.target.value);
                  }}
                />
                <Button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const result = tx(writeContracts.FacilityBooking.transferOwnership(newOwner), update => {
                      console.log("???? Transaction Update:", update);
                      if (update && (update.status === "confirmed" || update.status === 1)) {
                        console.log(" ???? Transaction " + update.hash + " finished!");
                        console.log(
                          " ?????? " +
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
                  Submit 
                  </Button>
              </div>
            </TabPane>
            <TabPane tab="Withdraw" key="3">
              <h2>Withdraw Contract Balance</h2>
              <div style={{ margin: 8 }}>
                <Button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const result = tx(writeContracts.FacilityBooking.withdraw(), update => {
                      console.log("???? Transaction Update:", update);
                      if (update && (update.status === "confirmed" || update.status === 1)) {
                        console.log(" ???? Transaction " + update.hash + " finished!");
                        console.log(
                          " ?????? " +
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
                  Withdraw 
                  </Button>
              </div>
            </TabPane>
            <TabPane tab="History" key="4">
              <h2>History</h2>
              <div style={{ margin: 8 }}>
                <Button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const result = await getBookingData();
                    setHistory(Object.entries(result));
                  }}
                  >
                  Export
                  </Button>
              </div>
              <List
                bordered
                dataSource={history}
                renderItem={bookinData => {
                  const start = moment(parseInt(bookinData[1][0])).format("YYYY/MM/DD ddd hh:mm a");
                  const end = moment(parseInt(bookinData[1][1])).format("hh:mm a");
                  const resident = bookinData[1][2];
                  const fee = parseInt(bookinData[1][3]);

                  return (
                    <List.Item>
                      <div>Time: {start} - {end}</div>
                      <div>Who: {resident}</div>
                      <div>Paid: {fee}</div>
                    </List.Item>
                  );
                }}
              />
            </TabPane>
          </Tabs>
      </div>
    </div>
  );

  // If the current user is NOT admin, then show below.
  const noContractDisplay = (
    <div>
      <p style={{ marginTop: 20, color: "red"}}>This is admin page. You must use the contract owner address!</p>
    </div>
  );

  return (
    <div>
      { (address == owner) ? contractDisplay : noContractDisplay }
    </div>
  );
}
