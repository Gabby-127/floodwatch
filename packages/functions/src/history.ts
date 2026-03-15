import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TTL_HOURS = 24;
const TTL_SECONDS = TTL_HOURS * 60 * 60;

export const handler: Handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "POST";

  // GET /history/{drainId} — return history for a drain
  if (method === "GET") {
    try {
      const drainId = event.pathParameters?.drainId || event.pathParameters?.id;

      if (!drainId) {
        return jsonResponse(400, { error: "Missing drainId" });
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName: Resource.HistoryMetrics.name,
          KeyConditionExpression: "D_Id = :id",
          ExpressionAttributeValues: { ":id": drainId },
          ScanIndexForward: true,
        })
      );

      return jsonResponse(200, result.Items || []);
    } catch (error: any) {
      console.error("History GET error:", error);
      return jsonResponse(500, { error: "Failed to fetch history", details: error.message });
    }
  }

  // POST /history — save a new history record
  try {
    let body = event;
    if (event.body) {
      body = JSON.parse(event.body);
    }

    const { D_Id, level, co2, location } = body;

    if (!D_Id) {
      return jsonResponse(400, { error: "Missing required field: D_Id" });
    }

    if (level === undefined && co2 === undefined) {
      return jsonResponse(400, { error: "Missing required fields: level or co2" });
    }

    const now = new Date();
    const timestamp = Date.now();
    const expiresAt = Math.floor((now.getTime() + TTL_SECONDS * 1000) / 1000);

    const historyRecord = {
      D_Id,
      Timestamp: timestamp,
      ExpiresAt: expiresAt,
      Level: level !== undefined ? level : null,
      CO2: co2 !== undefined ? co2 : null,
      Location: location || "Unknown",
      ReceivedAt: now.toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: Resource.HistoryMetrics.name,
        Item: historyRecord,
      })
    );

    return jsonResponse(200, {
      success: true,
      message: `History record saved for ${D_Id}`,
      data: historyRecord,
    });
  } catch (error: any) {
    console.error("History POST error:", error);
    return jsonResponse(500, { error: "Failed to save history record", details: error.message });
  }
};

function jsonResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

