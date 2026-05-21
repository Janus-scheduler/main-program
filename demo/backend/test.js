// using native fetch

async function test() {
  const res = await fetch("http://localhost:3001/api/insecure/data");
  const data = await res.json();
  console.log("RESOURCES:");
  console.log(JSON.stringify(data.resources, null, 2));
}

test();
