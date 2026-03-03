import React from "react";
import "./styles.css";
import Switch from "./Switch";

export default function App() {
  const [value, setValue] = React.useState(false);
  return (
    <div className="App">
      <h1>Wi-Fi</h1>
      <Switch
        isOn={value}
        onColor="#4DD863"
        handleToggle={() => setValue(!value)}
      />
    </div>
  );
}
