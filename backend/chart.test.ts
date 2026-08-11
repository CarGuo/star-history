import assert from "node:assert/strict";
import test from "node:test";
import api from "../shared/common/api.js";
import { getRepoData } from "../shared/common/chart.js";

test("restricted stargazer access is rejected instead of rendered as an empty chart", async () => {
  const mutableApi = api as any;
  const originals = {
    getRepoStarRecords: mutableApi.getRepoStarRecords,
    getRepoLogoUrl: mutableApi.getRepoLogoUrl,
    getRepoStargazersCount: mutableApi.getRepoStargazersCount,
  };

  mutableApi.getRepoStarRecords = async () => {
    throw { response: { status: 404 } };
  };
  mutableApi.getRepoLogoUrl = async () => "https://example.com/logo.png";
  mutableApi.getRepoStargazersCount = async () => 123;

  try {
    await assert.rejects(
      getRepoData(["owner/repo"], "test-token"),
      (error: any) => error.status === 403 && error.repo === "owner/repo"
    );
  } finally {
    Object.assign(mutableApi, originals);
  }
});
