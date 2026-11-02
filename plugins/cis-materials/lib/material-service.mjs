const MAX_ITEMS = 50;
const MAX_PAGE_REFERENCES = 500;
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const MESSAGES = Object.freeze({
  AUTH_REQUIRED: "需要本人完成知识库授权。",
  ACCESS_DENIED: "当前身份无权读取该知识元数据。",
  UPSTREAM_UNAVAILABLE: "知识服务暂不可用。",
  RELEASE_MISMATCH: "知识版本已变化，请重新检索。",
  NOT_FOUND: "未找到该知识图片引用。",
  INVALID_INPUT: "请求参数无效。",
  UPSTREAM_INVALID: "知识服务返回了不符合约定的数据。",
});
const BOUNDARY = Object.freeze({
  source: "flipbelt_kb",
  access_scope: "released_kb_image_metadata_only",
  download_enabled: false,
  license_status: "unknown",
  rights_status: "unknown",
  purpose_status: "unknown",
});
class MaterialFailure extends Error {
  constructor(code) { super(MESSAGES[code]); this.code = code; }
}
const fail = code => { throw new MaterialFailure(code); };
const record = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const identifier = (value, code = "UPSTREAM_INVALID") => {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) fail(code);
  return value;
};
function text(value, max, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail("UPSTREAM_INVALID");
  // Metadata fields are display text, never a second route for access URLs or paths.
  if (/(?:[a-z][a-z0-9+.-]*:\/\/|(?:^|\s)(?:data:|file:|mailto:|tel:|javascript:|vbscript:)|\\\\|(?:^|\s)\/[a-z0-9_.-]+\/|(?:^|\s)[a-z]:[\/\\])/i.test(value)) fail("UPSTREAM_INVALID");
  return value.trim();
}
function size(value) {
  const parsed = typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000_000) fail("UPSTREAM_INVALID");
  return parsed;
}
function inputFor(name, input) {
  const keys = name === "search_materials" || name === "list_collections" ? ["query", "limit"]
    : name === "read_material" ? ["page_id", "asset_id", "expected_release"]
      : name === "get_collection" ? ["page_id", "expected_release"] : null;
  if (!keys || !record(input) || Object.keys(input).some(key => !keys.includes(key))) fail("INVALID_INPUT");
  if (keys.includes("query")) {
    if (typeof input.query !== "string" || /[\u0000-\u001f\u007f]/.test(input.query)) fail("INVALID_INPUT");
    const query = input.query.trim(), limit = input.limit === undefined ? 3 : input.limit;
    if (!query || query.length > 120 || /(?:[a-z][a-z0-9+.-]*:\/\/|(?:^|\s)(?:data:|file:|mailto:|tel:|javascript:|vbscript:)|^[\/\\]|(?:^|\s)[a-z]:[\/\\]|\\\\)/i.test(query)
      || !Number.isInteger(limit) || limit < 1 || limit > 5) fail("INVALID_INPUT");
    return { query, limit };
  }
  const result = {};
  for (const key of keys) result[key] = identifier(input[key], "INVALID_INPUT");
  return result;
}
function envelope(raw, expectedRelease) {
  if (!record(raw) || !Object.hasOwn(raw, "data")) fail("UPSTREAM_INVALID");
  const releaseId = identifier(raw.release_id);
  if (expectedRelease !== undefined && releaseId !== expectedRelease) fail("RELEASE_MISMATCH");
  return { releaseId, data: raw.data };
}
function pageFrom(raw, pageId, expectedRelease) {
  const { releaseId, data } = envelope(raw, expectedRelease);
  if (!record(data) || data.pageId !== pageId) fail("UPSTREAM_INVALID");
  if (data.publishStatus !== "ready" || data.knowledgeStatus !== "published") fail("ACCESS_DENIED");
  if (!Array.isArray(data.assets) || data.assets.length > MAX_PAGE_REFERENCES) fail("UPSTREAM_INVALID");
  const title = text(data.title, 300), contentVersion = text(data.contentVersion, 80);
  if (!title || !contentVersion) fail("UPSTREAM_INVALID");
  return { pageId, title, contentVersion, releaseId, assets: data.assets };
}
function imageReferences(page) {
  const images = [], seen = new Set();
  for (const asset of page.assets) {
    if (!record(asset) || typeof asset.mime_type !== "string") fail("UPSTREAM_INVALID");
    const mime = asset.mime_type.toLowerCase();
    if (!IMAGE_MIMES.has(mime) || asset.asset_status !== "ready") continue;
    const assetId = identifier(asset.asset_id);
    if (seen.has(assetId)) continue;
    const name = text(asset.display_name, 300);
    if (!name) fail("UPSTREAM_INVALID");
    const sectionId = asset.section_id === null || asset.section_id === undefined ? null : identifier(asset.section_id);
    images.push({
      asset_id: assetId, name, alt: text(asset.alt_text, 1000, { optional: true }),
      mime_type: mime, size_bytes: size(asset.size_bytes), section_id: sectionId,
      page_id: page.pageId, page_title: page.title, release_id: page.releaseId, content_version: page.contentVersion,
      license_status: "unknown", rights_status: "unknown", purpose_status: "unknown",
    });
    seen.add(assetId);
  }
  return images;
}
function collectionFor(page, images, includeItems) {
  return {
    page_id: page.pageId, title: page.title, release_id: page.releaseId, content_version: page.contentVersion,
    selection_kind: "derived_from_released_page", human_curated: false, is_dam_collection: false,
    image_count: images.length, license_status: "unknown", rights_status: "unknown", purpose_status: "unknown",
    ...(includeItems ? { items: images.slice(0, MAX_ITEMS), count: Math.min(images.length, MAX_ITEMS), truncated: images.length > MAX_ITEMS } : {}),
  };
}

export function createMaterialService({ invoke } = {}) {
  if (typeof invoke !== "function") throw new TypeError("A metadata invoke port is required.");
  async function call(tool, args) {
    try { return await invoke(tool, args); }
    catch (error) {
      const code = error && Object.hasOwn(MESSAGES, error.code) ? error.code : "UPSTREAM_UNAVAILABLE";
      fail(code);
    }
  }
  async function readPage(pageId, expectedRelease) {
    return pageFrom(await call("get_flipbelt_page", { page_id: pageId }), pageId, expectedRelease);
  }
  return {
    async invoke(name, rawInput) {
      try {
        const input = inputFor(name, rawInput);
        if (name === "search_materials" || name === "list_collections") {
          const result = envelope(await call("search_flipbelt_kb", input));
          if (!Array.isArray(result.data) || result.data.length > 50) fail("UPSTREAM_INVALID");
          const pageIds = [], seenPages = new Set();
          for (const hit of result.data) {
            if (!record(hit)) fail("UPSTREAM_INVALID");
            const id = identifier(hit.page_id);
            if (!seenPages.has(id)) { pageIds.push(id); seenPages.add(id); }
          }
          const items = [], seenAssets = new Set();
          let truncated = pageIds.length > input.limit;
          for (const id of pageIds.slice(0, input.limit)) {
            const page = await readPage(id, result.releaseId), images = imageReferences(page);
            if (name === "list_collections") {
              if (images.length) items.push(collectionFor(page, images, false));
            } else for (const image of images) {
              if (seenAssets.has(image.asset_id)) continue;
              if (items.length < MAX_ITEMS) items.push(image); else truncated = true;
              seenAssets.add(image.asset_id);
            }
          }
          return { ok: true, data: { ...BOUNDARY, release_id: result.releaseId, items, count: items.length, truncated } };
        }
        const page = await readPage(input.page_id, input.expected_release), images = imageReferences(page);
        if (name === "get_collection") return { ok: true, data: { ...BOUNDARY, collection: collectionFor(page, images, true) } };
        const material = images.find(image => image.asset_id === input.asset_id);
        if (!material) fail("NOT_FOUND");
        const asset = envelope(await call("get_flipbelt_asset", { asset_id: input.asset_id }), input.expected_release).data;
        if (!record(asset) || asset.asset_id !== input.asset_id) fail("UPSTREAM_INVALID");
        if (asset.asset_status !== "ready") fail("NOT_FOUND");
        if (asset.mime_type !== material.mime_type || size(asset.size_bytes) !== material.size_bytes) fail("UPSTREAM_INVALID");
        // The upstream access result may contain a signed URL. No field is copied from it.
        return { ok: true, data: { ...BOUNDARY, material } };
      } catch (error) {
        const code = error instanceof MaterialFailure ? error.code : "UPSTREAM_INVALID";
        return { ok: false, error: { code, message: MESSAGES[code] } };
      }
    },
  };
}
