

// DynamoDB tables for heartbeat and sensor data monitoring
/// <reference path="../.sst/platform/config.d.ts" />

export const heartbeatTable = new sst.aws.Dynamo("SensorHeartbeat", {
  fields: {
    D_Id: "string",
    Timestamp: "number",
  },
  primaryIndex: { hashKey: "D_Id", rangeKey: "Timestamp" },
  ttl: "Timestamp",
});

export const sensorDataTable = new sst.aws.Dynamo("SensorData", {
  fields: {
    D_Id: "string",
    Timestamp: "number",
  },
  primaryIndex: { hashKey: "D_Id", rangeKey: "Timestamp" },
  ttl: "Timestamp",
});

export const historyMetricsTable = new sst.aws.Dynamo("HistoryMetrics", {
  fields: {
    D_Id: "string",
    Timestamp: "number",
  },
  primaryIndex: { hashKey: "D_Id", rangeKey: "Timestamp" },
  ttl: "ExpiresAt",
});

