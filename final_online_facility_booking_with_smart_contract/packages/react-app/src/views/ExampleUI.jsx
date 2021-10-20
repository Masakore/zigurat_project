import { SyncOutlined } from "@ant-design/icons";
import { utils } from "ethers";
import { Button, Card, Divider, Input, List, Progress, Slider, Spin, Switch, Tabs } from "antd";
import React, { useState } from "react";
import { Address, Balance } from "../components";
import moment from "moment";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

export default function ExampleUI({
  purpose,
  setNewBookingEvents,
  setCancelBookingEvents,
  address,
  mainnetProvider,
  localProvider,
  yourLocalBalance,
  price,
  tx,
  readContracts,
  writeContracts,
}) {
  const { TabPane } = Tabs;
  const defaultTime = new Date().setHours(9, 0);
  const [startDate, setStartDate] = useState(defaultTime);
  // TODO add display variables to use separately
  const [bookingStartDisplay, setBookingStartDisplay] = useState(defaultTime);
  const [bookingEndDisplay, setBookingEndDisplay] = useState(defaultTime);
  const [newBookingStart, setNewBookingStart] = useState(new Date(defaultTime).getTime());
  const [newBookingEnd, setNewBookingEnd] = useState(new Date(defaultTime).getTime());
  const addressToBooking = new Map();
  const dateToTime = new Map();

  setNewBookingEvents.map(item => {
    const address = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);
    if (!dateToTime[date]) {
      dateToTime[date] = [[start, end]];
    } else {
      dateToTime[date].push([start, end]);
    }

    if (!addressToBooking[address]) {
      addressToBooking[address] = [[start, end]];
    } else {
      addressToBooking[address].push([start, end]);
    }
  });

  setCancelBookingEvents.map(item => {
    console.log("=====================================cancelled log", item)
    const address = item.args[1];
    const date = moment(parseInt(item.args[2]._hex)).format("YYYYMMDD");
    const start = parseInt(item.args[2]._hex);
    const end = parseInt(item.args[3]._hex);
    if (dateToTime[date]) {
      dateToTime[date] = dateToTime[date].filter(time => !(time[0] < end && time[1] > start));
    }

    if (addressToBooking[address]) {
      addressToBooking[address] = addressToBooking[address].filter(time => !(time[0] < end && time[1] > start));
    }
  });
  console.log("dateToTime map after applying canceled booking:", JSON.stringify(dateToTime));

  const filterPassedDate = (time) => {
    const day = moment(time).day();
    return day !== 0 && day !== 6;
  };

  const filterPassedTime = time => {
    if (!filterPassedDate(time)) {
      return false;
    }
    const start = new Date(time).setHours(9, 0, 0);
    const end = new Date(time).setHours(22, 0, 0);
    if (time < start || end < time) {
      return false;
    }
    const date = moment(time).format("YYYYMMDD");
    const selectedTimestamp = time.getTime();
  
    if (dateToTime[date]) {
      const result = dateToTime[date].filter(item => {
        return selectedTimestamp >= item[0] && selectedTimestamp <= item[1];
      });
      return result.length > 0 ? false : true;
    }
    return true;
  };

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 600, margin: "auto", marginTop: 64 }}>
        <h2>Select date and time</h2>
        <div>
          <DatePicker
            inline
            selected={startDate}
            minDate={new Date()}
            filterDate={filterPassedDate}
            onChange={date => {
              setStartDate(date);
              setBookingStartDisplay(date);
              setBookingEndDisplay(date);
            }}
            dateFormat="yyyy-MM-dd hh:mm"
            shouldCloseOnSelect={false}
          >
            <div style={{ color: "grey" }}>**Gray color are not avaiable**</div>
          </DatePicker>
        </div>
        <div style={{ display: "flex", marginTop: 20 }}>
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
                  setBookingStartDisplay(date);
                  setNewBookingStart(new Date(date).getTime());
                }}
                dateFormat="hh:mm"
              />
            </div>
          </div>
          <div>
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
                  setBookingEndDisplay(date);
                  setNewBookingEnd(new Date(date).getTime());
                }}
                dateFormat="hh:mm"
              />
            </div>
          </div>
        </div>
        <div style={{ margin: 8 }}>
          <Button
            style={{ marginTop: 8 }}
            onClick={async () => {
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
              console.log("awaiting metamask/web3 confirm result...", result);
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
              <h2>Your Upcoming Booking</h2>
              <List
                bordered
                dataSource={addressToBooking[address]}
                renderItem={date_time => {
                  if (date_time[0] < new Date().getTime()) {
                    return;
                  }
                  const start = moment(date_time[0]).format("YYYY/MM/DD hh:mm");
                  const end = moment(date_time[1]).format("hh:mm");
                  return (
                    <List.Item>
                      {start} - {end}
                      <Button
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
                          console.log("canceled?:", await result);
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
                dataSource={addressToBooking[address]}
                renderItem={date_time => {
                  const start = moment(date_time[0]).format("YYYY/MM/DD hh:mm");
                  const end = moment(date_time[1]).format("hh:mm");
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
