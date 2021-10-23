import { utils } from "ethers";
import { Button, Card, Divider, Input, List, Progress, Slider, Spin, Switch, Tabs, Row, Col } from "antd";
import React, { useState, useEffect, useContext, useLayoutEffect } from "react";
import { Account, Address, Balance } from "../components";
import moment from "moment";
import DatePicker from "react-datepicker";
import { OwnerContext } from "../App";

import "react-datepicker/dist/react-datepicker.css";
import { isNonEmptyArray } from "@apollo/client/utilities";

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
}) {
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
  const [dateToTime, setDateToTime] = useState(new Map());
  const [allUpcomingBooking, setAllUpcomingBooking] = useState([]);
  const [history, setHistory] = useState([]);
  const currentTime = new Date();

  const refreshUpcomingBooking = () => setNewBookingEvents.map(item => {
    const address = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);
    if (!dateToTime.has(date)) {
      setDateToTime(new Map(dateToTime.set(date, [[start, end]])));
    } else {
      let existingDates = dateToTime.get(date);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      setDateToTime(new Map(dateToTime.set(date, [...existingDates, [start, end]])));
    }

    if (start < currentTime) {
      return;
    }

      setAllUpcomingBooking([...allUpcomingBooking, [start, end, address]]);
    // if (!allUpcomingBooking) {
    //   // Timing issue. Sometimes allUpcomingBooking is not initialized before coming here
    // // } else if (allUpcomingBooking.length == 0) {
    // //   setAllUpcomingBooking(new Array(allUpcomingBooking.push([start, end, address])));
    // } else {
    //   // const filtered = allUpcomingBooking.filter(time => !(time[0] < end && time[1] > start));
    //   setAllUpcomingBooking([...allUpcomingBooking, [start, end, address]]);
    //   // console.log("中です1", filtered)
    //   console.log("中です2", allUpcomingBooking)
    // }
  });

  const refrechCanceledBooking = () => setCancelBookingEvents.map(item => {
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);
    let tmpDateToTime = dateToTime;
    if (tmpDateToTime[date]) {
      tmpDateToTime[date] = tmpDateToTime[date].filter(time => !(time[0] < end && time[1] > start));
    }
    setDateToTime(tmpDateToTime);
    
    // let tmpAllUpcomingBooking = allUpcomingBooking;
    // if (start > currentTime) {
    //   tmpAllUpcomingBooking = tmpAllUpcomingBooking.filter(time => !(time[0] < end && time[1] > start));
    // }
    // setAllUpcomingBooking(tmpAllUpcomingBooking)
    if (start > currentTime) {
      let filtered = allUpcomingBooking.filter(time => !(time[0] < end && time[1] > start));
      console.log("filter worked?", filtered)
      setAllUpcomingBooking([...filtered]);
    }
  });

  const refreshBalance = async () => {
    if (owner && owner == address && writeContracts.FacilityBooking) {
      const response = await writeContracts.FacilityBooking.getBalance();
      setLatestBalance(BigInt(response._hex));
    }
  }

  useEffect(async () => {
    await refreshBalance();
    await refreshUpcomingBooking();
    // await refrechCanceledBooking();
  }, [setNewBookingEvents, setCancelBookingEvents]);

  const getBookingData = async () => {
    if (readContracts.FacilityBooking) {
      let result = await readContracts.FacilityBooking.getBookingData("tennis");
      return result;
    }
    return [];
  };

  const filterPassedDate = (time) => {
    const day = moment(time).day();
    return day !== 0 && day !== 6;
  };

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


  const EndTimeExceedStartError = () => (
    <p style={{ color: "red" }}>The start time cannot exceed the end time!</p>
  )

  const OldDateSelectedError = () => (
    <p style={{color: "red"}}>You chose a wrong pair of the start and the end slot. Booking time must be future!</p>
  )

  const contractDisplay = (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 600, margin: "auto", marginTop: 64 }}>
        <h2>{buildingName}</h2>
        <div style={{ fontSize: 20 }}>Facility: {facilityName}</div>
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
              const current = new Date();
              if (bookingStartDisplay < current || bookingEndDisplay < current) {
                setOldDateSelectedError(true);
                return;
              }
              if (bookingStartDisplay >= bookingEndDisplay) {
                setEndTimeExceedStartError(true);
                return;
              }

              const fee = 1000 * ((newBookingEnd - newBookingStart) / (30 * 60 * 1000));
              const result = tx(
                writeContracts.FacilityBooking.register(newBookingStart, newBookingEnd, "tennis", {
                  value: 1000,
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
              console.log("New Book, awaiting metamask/web3 confirm result...", result);
              console.log(await result);
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
