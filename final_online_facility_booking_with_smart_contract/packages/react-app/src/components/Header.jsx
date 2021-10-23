import { PageHeader } from "antd";
import React from "react";

// displays a page header

export default function Header() {
  return (
    <a href="https://github.com/Masakore/zigurat_project/tree/master/final_online_facility_booking_with_smart_contract" target="_blank" rel="noopener noreferrer">
      <PageHeader
        title="Facility Booking App"
        subTitle="facility booking management system"
        style={{ cursor: "pointer" }}
      />
    </a>
  );
}
