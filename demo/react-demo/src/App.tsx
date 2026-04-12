import "./App.css";
import { Scheduler } from "@janus-scheduler/react";

function App() {
  return (
    <div>
      <Scheduler onClose={() => console.log("Scheduler closed")} />
    </div>
  );
}

export default App;
