import { parse as parseUrl } from "url";

export const parseMetadata = (metadata: any) => {
  try {
    const parsedMetadata = JSON.parse(metadata);
    Object.keys(parsedMetadata).forEach(
      (k) => (parsedMetadata[k] = parsedMetadata[k].trim())
    );
    return { ...parsedMetadata, raw: metadata };
  } catch (err) {
    return { raw: metadata };
  }
};

export const parseRequest = (requestString: any) => {
  try {
    const parsedRequest: any = {};
    const lines = requestString.split("\r\n");
    const parsedRequestLine: any = parseRequestLine(lines.shift());

    parsedRequest["method"] = parsedRequestLine["method"];
    parsedRequest["uri"] = parsedRequestLine["uri"];
    const parsedUrl = parseUrl(parsedRequestLine["uri"], true);
    parsedRequest["query"] = parsedUrl.query;
    parsedRequest["headers"] = parseHeaders(lines);
    parsedRequest["body"] = parseBody(lines);
    return { ...parsedRequest, raw: requestString };
  } catch (err) {
    return { raw: requestString };
  }
};

export const parseResponse = (responseString: any) => {
  try {
    const parsedResponse: any = {};
    const lines = responseString.split("\r\n");
    const parsedStatusLine: any = parseStatusLine(
      findResponseStatusLine(lines)
    );
    parsedResponse["protocolVersion"] = parsedStatusLine["protocol"];
    parsedResponse["statusCode"] = parsedStatusLine["statusCode"];
    parsedResponse["statusMessage"] = parsedStatusLine["statusMessage"];
    parsedResponse["headers"] = parseHeaders(lines);
    parsedResponse["body"] = parseBody(lines);

    return { ...parsedResponse, raw: responseString };
  } catch (err) {
    return { raw: responseString };
  }
};

const findResponseStatusLine = (lines: any) => {
  let line = lines.shift();
  while (!line || line === "\r\n") {
    line = lines.shift();
  }

  return line;
};

const tryParseBody = (lines: string[]) => {
  const linesStr = lines.join();
  try {
    return JSON.parse(linesStr);
  } catch (err) {
    return {};
  }
};

const parseBody = (lines: string[]) => {
  let body = tryParseBody(lines);
  if (Object.keys(body).length > 0) return body;
  let line = lines.shift();
  while (line) {
    body = tryParseBody(lines);
    line = lines.shift();
  }
  return body;
};

const parseHeaders = (lines: any) => {
  const headerLines: any = [];
  while (lines.length > 0) {
    const line = lines.shift().trim();
    if (line == "") break;
    headerLines.push(line);
  }

  const headers: any = {};
  for (const line of headerLines) {
    const parts = line.split(":");
    const key: any = parts.shift();
    headers[key] = parts.join(":").trim();
  }

  return headers;
};

const parseStatusLine = (statusLine: any) => {
  const parts = statusLine.match(/^(.+) ([0-9]{3}) (.*)$/gm);
  const parsed: any = {};
  if (parts?.length > 0) {
    const splittedParts = parts[0].split(" ");
    parsed["protocol"] = splittedParts[0];
    parsed["statusCode"] = splittedParts[1];
    parsed["statusMessage"] = splittedParts[2];
  }
  return parsed;
};

const parseRequestLine = (requestLineString: any) => {
  const parts = requestLineString.split(" ");
  const parsed: any = {};
  parsed["method"] = parts[0];
  parsed["uri"] = parts[1];
  parsed["protocol"] = parts[2];
  return parsed;
};
