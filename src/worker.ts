import { connect } from '@planetscale/database';
export default {
  async fetch(request, env) {
    console.log(`got request ${request.method}`);


    if (request.method === "OPTIONS") {
      console.log(`Found options request`);
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Headers": request.headers.get(
            "Access-Control-Request-Headers"
          ),
        },
      });
    }

    async function readRequestBody(request) {
      const contentType = request.headers.get("content-type");
      if (contentType.includes("application/json")) {
        return request.json();
      }
    }

    if (request.method !== "POST") {
      return new Response("Only taking POST");
    }

    const reqBody = await readRequestBody(request);
    const retBody = `The request body sent in was ${reqBody}`;

    const { cf } = request;
    const { city, country } = cf;
    console.log(`Request came from city: ${city} in country: ${country} with reqBody: ${reqBody.prompt}`);

    if (reqBody.prompt === undefined || reqBody.prompt === "\n\n###\n\n") {
      return new Response("No prompt provided");
    }

    if (reqBody.temperature === undefined) {
      return new Response("No temperature provided");
    }

    // send to openai
    const openaiURL = "https://api.openai.com/v1/completions";
    //const url = someHost + "/requests/json";
    const payload = {
      model: "ada:ft-personal-2023-08-06-14-51-57",
      prompt: reqBody.prompt,
      temperature: reqBody.temperature,
      max_tokens: 400,
      stop: "#-3298-#",
    };

    const postRequestToSend = {
      body: JSON.stringify(payload),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.OPENAI_KEY,
      },
    };
    const response = await fetch(openaiURL, postRequestToSend);

    /**
     * gatherResponse awaits and returns a response body as a string.
     * Use await gatherResponse(..) in an async function to get the response body
     * @param {Response} response
     */
    async function gatherResponse(response) {
      const { headers } = response;
      const contentType = headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return JSON.stringify(await response.json());
      } else if (contentType.includes("application/text")) {
        return response.text();
      } else if (contentType.includes("text/html")) {
        return response.text();
      } else {
        return response.text();
      }
    }

    const results = await gatherResponse(response);

    const config = {
      host: env.DATABASE_HOST,
      username: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
		      fetch: (urll, initt) => {
			    delete (initt)["cache"];
			    return fetch(urll, initt);
      }
    }
    const conn = connect(config)
    await conn.execute("INSERT INTO chats (prompt, temperature, response) VALUES (?, ?, ?)", [reqBody.prompt, reqBody.temperature, results])
    

    const myOptions = { status: 200, statusText: "wow got to the end", headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Headers": request.headers.get(
        "Access-Control-Request-Headers"
      ),
    },};

    return new Response(JSON.stringify(results), myOptions);
  },
};
