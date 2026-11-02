import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialService } from "../../plugins/cis-materials/lib/material-service.mjs";

// Every record in this file is a synthetic fixture; no real media, account or access URL is used.
const RELEASE = "synthetic-release-v1";
const PAGE = "page_fixture_alpha";
const ASSET = "asset_fixture_alpha";
const secret = "SYNTHETIC_PRIVATE_SENTINEL";
const clone = value => structuredClone(value);
const envelope = (data, release = RELEASE) => ({
  schema_version: "synthetic-kb-fixture-v1", release_id: release, source_commit: "synthetic-commit",
  source_kind: "synthetic_test_fixture", source_ref: "synthetic-source", content_set_sha256: "synthetic-hash",
  updated_at: "2026-10-22T00:00:00.000Z", synthetic: true, data,
});
const image = (id = ASSET, patch = {}) => ({
  asset_id: id, source_path: "private/" + secret + ".webp", display_name: "合成图片元数据",
  asset_type: "other", asset_status: "ready", mime_type: "image/webp", size_bytes: "1234",
  section_id: "section_fixture", role: "inline", interaction: "preview", alt_text: "只观察光线。",
  url: "https://example.invalid/private?token=" + secret, owner_email: secret + "@example.invalid",
  ...patch,
});
const page = (id = PAGE, assets = [image()], patch = {}) => ({
  pageId: id, sourcePath: "private/" + secret, title: "合成知识页", contentVersion: "1.6",
  publishStatus: "ready", knowledgeStatus: "published", visibility: { level: "internal" },
  fileSha256: "synthetic-page-digest", metadata: { private: secret },
  markdown: secret, plainText: secret, sections: [], references: [{ private: secret }],
  assets, ...patch,
});
function fixture({ pages = { [PAGE]: page() }, hits = [{ page_id: PAGE }], accessPatch = {}, failure } = {}) {
  const calls = [];
  const service = createMaterialService({ async invoke(tool, args) {
    calls.push({ tool, args: clone(args) });
    if (failure) return failure(tool, args);
    if (tool === "search_flipbelt_kb") return envelope(clone(hits));
    if (tool === "get_flipbelt_page") return envelope(clone(pages[args.page_id]));
    if (tool === "get_flipbelt_asset") return envelope({
      asset_id: args.asset_id, display_name: secret, asset_type: "other", asset_status: "ready",
      mime_type: "image/webp", size_bytes: "1234", expires_in: 120,
      url: "https://example.invalid/private?signature=" + secret, ...accessPatch,
    });
    throw new Error(secret);
  } });
  return { service, calls };
}
const readInput = { page_id: PAGE, asset_id: ASSET, expected_release: RELEASE };
const collectionInput = { page_id: PAGE, expected_release: RELEASE };
function ok(result) { assert.equal(result.ok, true); return result.data; }
function failure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok"]);
  assert.deepEqual(Object.keys(result.error).sort(), ["code", "message"]);
  assert.equal(result.error.code, code);
  assert.equal(JSON.stringify(result).includes(secret), false);
  return result.error;
}
function boundary(data) {
  assert.equal(data.source, "flipbelt_kb");
  assert.equal(data.download_enabled, false);
  assert.equal(data.access_scope, "released_kb_image_metadata_only");
  for (const key of ["license_status", "rights_status", "purpose_status"]) assert.equal(data[key], "unknown");
  for (const forbidden of ["source_path", "sourcePath", "url", "expires_in", "owner_email", "markdown", "plainText", "fileSha256", "objectKey"])
    assert.equal(JSON.stringify(data).includes('"' + forbidden + '"'), false);
  assert.equal(JSON.stringify(data).includes(secret), false);
}

test("search parses released page images, filters video/SVG/unready and dedupes without private fields", async () => {
  const { service, calls } = fixture({ pages: { [PAGE]: page(PAGE, [
    image(), image(), image("asset_video", { mime_type: "video/mp4" }),
    image("asset_svg", { mime_type: "image/svg+xml" }), image("asset_not_ready", { asset_status: "draft" }),
  ]) }, hits: [{ page_id: PAGE, snippet: secret }, { page_id: PAGE, section_id: "other" }] });
  const data = ok(await service.invoke("search_materials", { query: " 合成 ", limit: 3 }));
  boundary(data);
  assert.equal(data.count, 1);
  assert.equal(data.items[0].asset_id, ASSET);
  assert.equal(data.items[0].size_bytes, 1234);
  assert.equal(data.items[0].content_version, "1.6");
  assert.deepEqual(calls.map(x => x.tool), ["search_flipbelt_kb", "get_flipbelt_page"]);
  assert.deepEqual(calls[0].args, { query: "合成", limit: 3 });
});

test("strict inputs reject unknown fields, URI queries, missing IDs and invalid limits before upstream", async () => {
  const { service, calls } = fixture();
  for (const input of [
    { query: "x", role: "admin" }, { query: "" }, { query: " " }, { query: "x".repeat(121) },
    { query: "https://example.invalid/private" }, { query: "参考 file://private" }, { query: "\\\\nas\\private" },
    { query: "data:image/png;base64,fixture" }, { query: "C:\\private\\fixture" }, { query: "mailto:fixture@example.invalid" }, { query: "x\u0000y" },
    ...[0, 6, -1, 1.5, "3", NaN, Infinity].map(limit => ({ query: "x", limit })),
  ]) failure(await service.invoke("search_materials", input), "INVALID_INPUT");
  failure(await service.invoke("get_collection", { ...collectionInput, extra: true }), "INVALID_INPUT");
  failure(await service.invoke("read_material", { ...readInput, asset_id: "https://example.invalid/id" }), "INVALID_INPUT");
  failure(await service.invoke("read_material", { page_id: PAGE, asset_id: ASSET }), "INVALID_INPUT");
  failure(await service.invoke("real_download", readInput), "INVALID_INPUT");
  assert.equal(calls.length, 0);
});

test("list collections derives image reference groups from released pages without claiming DAM curation", async () => {
  const { service, calls } = fixture();
  const data = ok(await service.invoke("list_collections", { query: "fixture" }));
  boundary(data);
  assert.equal(data.count, 1);
  const item = data.items[0];
  assert.equal(item.selection_kind, "derived_from_released_page");
  assert.equal(item.human_curated, false);
  assert.equal(item.is_dam_collection, false);
  assert.equal(item.image_count, 1);
  assert.equal(item.items, undefined);
  assert.equal(calls[0].args.limit, 3);
  assert.equal(calls.some(x => x.tool === "get_flipbelt_asset"), false);
});

test("get collection returns at most 50 images with explicit truncation and no asset access calls", async () => {
  const refs = Array.from({ length: 80 }, (_, n) => image("asset_fixture_" + n));
  const { service, calls } = fixture({ pages: { [PAGE]: page(PAGE, refs) } });
  const data = ok(await service.invoke("get_collection", collectionInput));
  boundary(data);
  assert.equal(data.collection.items.length, 50);
  assert.equal(data.collection.count, 50);
  assert.equal(data.collection.image_count, 80);
  assert.equal(data.collection.truncated, true);
  assert.deepEqual(calls.map(x => x.tool), ["get_flipbelt_page"]);
});

test("search is bounded to five pages and 50 deduped images, keeping only image metadata", async () => {
  const ids = Array.from({ length: 6 }, (_, n) => "page_fixture_" + n);
  const pages = Object.fromEntries(ids.map((id, n) => [id, page(id, Array.from({ length: 15 }, (_, i) => image("asset_fixture_" + n + "_" + i)))]));
  const { service, calls } = fixture({ pages, hits: ids.map(page_id => ({ page_id })) });
  const data = ok(await service.invoke("search_materials", { query: "fixture", limit: 5 }));
  boundary(data);
  assert.equal(data.count, 50);
  assert.equal(data.truncated, true);
  assert.equal(calls.filter(x => x.tool === "get_flipbelt_page").length, 5);
});

test("read material fetches fresh page membership and matching access metadata without returning access URL", async () => {
  const { service, calls } = fixture();
  const data = ok(await service.invoke("read_material", readInput));
  boundary(data);
  assert.equal(data.material.asset_id, ASSET);
  assert.equal(data.material.page_id, PAGE);
  assert.equal(data.material.release_id, RELEASE);
  assert.equal(data.material.name, "合成图片元数据");
  assert.deepEqual(calls, [
    { tool: "get_flipbelt_page", args: { page_id: PAGE } },
    { tool: "get_flipbelt_asset", args: { asset_id: ASSET } },
  ]);
});

test("cross-page or unsupported media references fail before requesting asset access", async () => {
  const { service, calls } = fixture({ pages: { [PAGE]: page(PAGE, [image(), image("asset_video", { mime_type: "video/mp4" })]) } });
  for (const asset_id of ["asset_other_page", "asset_video"])
    failure(await service.invoke("read_material", { ...readInput, asset_id }), "NOT_FOUND");
  assert.equal(calls.some(x => x.tool === "get_flipbelt_asset"), false);
});

test("expected release is mandatory and mismatch rejects before asset access", async () => {
  const { service, calls } = fixture();
  failure(await service.invoke("read_material", { ...readInput, expected_release: "synthetic-old-release" }), "RELEASE_MISMATCH");
  failure(await service.invoke("get_collection", { ...collectionInput, expected_release: "synthetic-old-release" }), "RELEASE_MISMATCH");
  assert.equal(calls.some(x => x.tool === "get_flipbelt_asset"), false);
});

test("search/page and page/access release mismatches fail closed without partial results", async () => {
  for (const mismatchTool of ["get_flipbelt_page", "get_flipbelt_asset"]) {
    const { service } = fixture({ failure(tool, args) {
      if (tool === "search_flipbelt_kb") return envelope([{ page_id: PAGE }]);
      if (tool === "get_flipbelt_page") return envelope(page(), tool === mismatchTool ? "synthetic-new-release" : RELEASE);
      return envelope({ asset_id: args.asset_id, asset_status: "ready", mime_type: "image/webp", size_bytes: "1234", url: secret },
        tool === mismatchTool ? "synthetic-new-release" : RELEASE);
    } });
    const name = mismatchTool === "get_flipbelt_page" ? "search_materials" : "read_material";
    failure(await service.invoke(name, name === "search_materials" ? { query: "fixture" } : readInput), "RELEASE_MISMATCH");
  }
});

test("page ID mismatch and unpublished pages cannot supply a collection or asset", async () => {
  for (const patch of [{ pageId: "page_other" }, { publishStatus: "draft" }, { knowledgeStatus: "draft" }]) {
    const { service, calls } = fixture({ pages: { [PAGE]: page(PAGE, [image()], patch) } });
    failure(await service.invoke("read_material", readInput), patch.pageId ? "UPSTREAM_INVALID" : "ACCESS_DENIED");
    assert.equal(calls.some(x => x.tool === "get_flipbelt_asset"), false);
  }
});

test("access metadata ID, MIME and declared size must match the released reference", async () => {
  for (const accessPatch of [
    { asset_id: "asset_other" }, { mime_type: "video/mp4" }, { mime_type: "image/png" },
    { size_bytes: "1235" }, { size_bytes: "-1" }, { size_bytes: "9007199254740993" },
  ]) {
    const { service } = fixture({ accessPatch });
    failure(await service.invoke("read_material", readInput), "UPSTREAM_INVALID");
  }
  const { service } = fixture({ accessPatch: { asset_status: "withdrawn" } });
  failure(await service.invoke("read_material", readInput), "NOT_FOUND");
});

test("fresh reads do not reuse an earlier authorized page snapshot after a release changes", async () => {
  let currentRelease = RELEASE;
  const { service } = fixture({ failure(tool, args) {
    if (tool === "get_flipbelt_page") return envelope(page(), currentRelease);
    return envelope({ asset_id: args.asset_id, asset_status: "ready", mime_type: "image/webp", size_bytes: "1234" }, currentRelease);
  } });
  ok(await service.invoke("read_material", readInput));
  currentRelease = "synthetic-new-release";
  failure(await service.invoke("read_material", readInput), "RELEASE_MISMATCH");
});

test("port authentication, permission and outage errors are constant and do not echo raw exception text", async () => {
  for (const code of ["AUTH_REQUIRED", "ACCESS_DENIED", "UPSTREAM_UNAVAILABLE", "NOT_FOUND"]) {
    const { service } = fixture({ failure() { throw Object.assign(new Error(secret), { code, private: secret }); } });
    failure(await service.invoke("get_collection", collectionInput), code);
  }
  const { service } = fixture({ failure() { throw new Error(secret); } });
  failure(await service.invoke("search_materials", { query: "fixture" }), "UPSTREAM_UNAVAILABLE");
});

test("malformed upstream shapes and access-like strings in display metadata are sanitized failures", async () => {
  const malformed = [
    null, { release_id: RELEASE }, envelope("private"), envelope({ ...page(), assets: "private" }),
    envelope(page(PAGE, [image("asset_fixture", { size_bytes: "12.3" })])),
    envelope(page(PAGE, [image("asset_fixture", { display_name: "https://example.invalid/?token=" + secret })])),
    envelope(page(PAGE, Array.from({ length: 501 }, () => image()))),
  ];
  for (const value of malformed) {
    const { service } = fixture({ failure() { return value; } });
    failure(await service.invoke("get_collection", collectionInput), "UPSTREAM_INVALID");
  }
});

test("returned metadata is detached from the upstream fixture and cannot grant use rights", async () => {
  const source = envelope(page()), before = clone(source);
  const { service } = fixture({ failure() { return source; } });
  const result = ok(await service.invoke("get_collection", collectionInput));
  result.collection.items[0].name = "changed";
  result.collection.items[0].rights_status = "licensed";
  assert.deepEqual(source, before);
  const fresh = ok(await service.invoke("get_collection", collectionInput));
  assert.equal(fresh.collection.items[0].name, "合成图片元数据");
  assert.equal(fresh.collection.items[0].rights_status, "unknown");
});
