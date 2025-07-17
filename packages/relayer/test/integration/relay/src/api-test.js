export const ping = async () => {
  let r = await fetch("http://localhost:3000/ping", {
    method: "get",
  });
  console.log(JSON.stringify(await r.text(), null, 2));
};

export const details = async () => {
  let r = await fetch("http://localhost:3000/relayer/details", {
    method: "get",
  });
  console.log(JSON.stringify(await r.json(), null, 2));
};

export const notFound = async () => {
  let r = await fetch("http://localhost:3000/HOLA", {
    method: "get",
  });
  console.log(JSON.stringify(await r.json(), null, 2));
};

export const request = async (requestBody) => {
  let r = await fetch("http://localhost:3000/relayer/request", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  console.log(JSON.stringify(await r.json(), null, 2));
};

export const quote = async (quoteBody) => {
  let r = await fetch("http://localhost:3000/relayer/quote", {
    method: "post",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(quoteBody)
  })
  const quoteResponse = await r.json();
  console.log(JSON.stringify(quoteResponse, null, 2))
  return quoteResponse;
}
