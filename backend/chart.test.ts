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
      (error: any) =>
        error.status === 403
        && error.repo === "owner/repo"
        && error.rateLimited === false
    );
  } finally {
    Object.assign(mutableApi, originals);
  }
});

test("a GitHub quota response is identified as a rate limit", async () => {
  const mutableApi = api as any;
  const originals = {
    getRepoStarRecords: mutableApi.getRepoStarRecords,
    getRepoLogoUrl: mutableApi.getRepoLogoUrl,
  };

  mutableApi.getRepoStarRecords = async () => {
    throw {
      response: {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
        data: { message: "API rate limit exceeded" },
      },
    };
  };
  mutableApi.getRepoLogoUrl = async () => "https://example.com/logo.png";

  try {
    await assert.rejects(
      getRepoData(["owner/repo"], "test-token"),
      (error: any) => error.status === 429 && error.rateLimited === true
    );
  } finally {
    Object.assign(mutableApi, originals);
  }
});

test("a GitHub permission 403 does not exhaust the token", async () => {
  const mutableApi = api as any;
  const originals = {
    getRepoStarRecords: mutableApi.getRepoStarRecords,
    getRepoLogoUrl: mutableApi.getRepoLogoUrl,
  };

  mutableApi.getRepoStarRecords = async () => {
    throw {
      response: {
        status: 403,
        headers: { "x-ratelimit-remaining": "4999" },
        data: { message: "Resource not accessible by personal access token" },
      },
    };
  };
  mutableApi.getRepoLogoUrl = async () => "https://example.com/logo.png";

  try {
    await assert.rejects(
      getRepoData(["owner/repo"], "test-token"),
      (error: any) => error.status === 403 && error.rateLimited === false
    );
  } finally {
    Object.assign(mutableApi, originals);
  }
});
