import "./App.css";
import Scheduler from "./../../../packages/wrappers/react-wrapper/cards/Scheduler";

function App() {
  return (
    <div>
      <Scheduler onClose={() => console.log("Scheduler closed")} />
    </div>
  );
}

export default App;
