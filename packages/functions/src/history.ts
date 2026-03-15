import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const HISTORY_TABLE = "HistoryMetrics";
const TTL_HOURS = 24;
const TTL_SECONDS = TTL_HOURS * 60 * 60;

export const handler: Handler = async (event: any) => {
  try {
    // Parse the event - can come from IoT Topic or API Gateway
    let body = event;
    if (event.body) {
      body = JSON.parse(event.body);
    }

    const { D_Id, level, co2, location } = body;

    if (!D_Id) {
      return jsonResponse(400, {
        error: "Missing required field: D_Id",
      });
    }

    if (level === undefined && co2 === undefined) {
      return jsonResponse(400, {
        error: "Missing required fields: level or co2",
      });
    }

    const now = new Date();
    const timestamp = Date.now();
    const expiresAt = Math.floor((now.getTime() + TTL_SECONDS * 1000) / 1000);

    // Save history record with TTL (auto-expires after 24 hours)
    const historyRecord = {
      D_Id: D_Id,
      Timestamp: timestamp,
      ExpiresAt: expiresAt,
      Level: level !== undefined ? level : null,
      CO2: co2 !== undefined ? co2 : null,
      Location: location || "Unknown",
      ReceivedAt: now.toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: HISTORY_TABLE,
        Item: historyRecord,
      })
    );

    return jsonResponse(200, {
      success: true,
      message: `History record saved for sensor ${D_Id}`,
      data: {
        D_Id: D_Id,
        Timestamp: timestamp,
        ExpiresAt: expiresAt,
        Level: level,
        CO2: co2,
        Location: location,
        RetentionHours: TTL_HOURS,
      },
    });
  } catch (error: any) {
    console.error("History function error:", error);

    return jsonResponse(500, {
      error: "Failed to save history record",
      details: error.message,
    });
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

