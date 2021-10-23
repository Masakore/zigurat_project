import { SyncOutlined } from "@ant-design/icons";
import { utils } from "ethers";
import { Button, Card, Divider, Input, List, Progress, Slider, Spin, Switch, Tabs } from "antd";
import React, { useState, useEffect } from "react";
import { Address, Balance } from "../components";
import moment from "moment";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";
import { isNonEmptyArray } from "@apollo/client/utilities";

export default function BookingUI({
  buildingName,
  facilityName,
  setNewBookingEvents,
  setCancelBookingEvents,
  address,
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
  const [dateToTime, setDateToTime] = useState(new Map());
  const [addressToBooking, setAddressToBooking] = useState(new Map());

  const refreshUpcomingBooking = () => setNewBookingEvents.map(item => {
    const bookerAddress = item.args[1];
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

    if (bookerAddress != address) {
      return;
    }
    if (!addressToBooking.has(address)) {
      setAddressToBooking(new Map(addressToBooking.set(address, [[start, end]])));
    } else {
      let existingDates = addressToBooking.get(address);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      setAddressToBooking(new Map(addressToBooking.set(address, [...existingDates, [start, end]])));
    }
  });

  const refrechCanceledBooking = () => setCancelBookingEvents.map(item => {
    const bookerAddress = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);

    if (dateToTime.has(date)) {
      let existingDates = dateToTime.get(date);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start));
      setDateToTime(new Map(dateToTime.set(date, [...existingDates])));
    }

    if (addressToBooking.has(bookerAddress)) {
      let existingDates = addressToBooking.get(bookerAddress);
      existingDates = existingDates.filter(time => !(time[0] < end && time[1] > start))
      setAddressToBooking(new Map(addressToBooking.set(bookerAddress, [...existingDates])));
    }
  });

  useEffect(async () => {
    await refreshUpcomingBooking();
    await refrechCanceledBooking();
    await console.log("dateToTime map after applying canceled booking:", JSON.stringify(dateToTime));
    await console.log("addressToBooking after applying canceled booking:", JSON.stringify(addressToBooking[address]));
  }, [setNewBookingEvents, setCancelBookingEvents]);

  const filterPassedDate = time => {
    const day = moment(time).day();
    return day !== 0 && day !== 6;
  };

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

  const EndTimeExceedStartError = () => (
    <p style={{ color: "red" }}>The start time cannot exceed the end time!</p>
  )

  const OldDateSelectedError = () => (
    <p style={{color: "red"}}>You chose a wrong pair of the start and the end slot. Booking time must be future!</p>
  );

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 600, margin: "auto", marginTop: 64 }}>
        <h2>{buildingName}</h2>
        <div style={{ fontSize: 20 }}>Facility: {facilityName}</div>
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

              const fee = 1000 * ((newBookingEnd - newBookingStart) / (30 * 60 * 1000));
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
            <TabPane tab="History" key="2">
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
