import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function verifyExtension(rootUrl, manifestOverride) {
  const root = fileURLToPath(rootUrl);
  const errors = [];
  let manifest = manifestOverride;
  if (!manifest) {
    try { manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")); }
    catch (error) { return { ok: false, errors: [`manifest.json 无效：${error.message}`] }; }
  }
  if (manifest.manifest_version !== 3) errors.push("manifest_version 必须为 3");
  if (Number(manifest.minimum_chrome_version) < 114) errors.push("minimum_chrome_version 必须至少为 114");
  for (const permission of ["tabs", "tabGroups", "storage", "sidePanel"]) if (!manifest.permissions?.includes(permission)) errors.push(`缺少权限 ${permission}`);
  const referenced = [manifest.background?.service_worker, manifest.side_panel?.default_path].filter(Boolean);
  for (const relative of referenced) {
    try { await access(path.join(root, relative)); } catch { errors.push(`缺少入口文件 ${relative}`); }
  }
  if (manifest.side_panel?.default_path) {
    try {
      const html = await readFile(path.join(root, manifest.side_panel.default_path), "utf8");
      if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push("扩展页面包含内联脚本");
      if (/<script[^>]+src=["']https?:/i.test(html)) errors.push("扩展页面包含远程脚本");
    } catch { /* missing is reported above */ }
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await verifyExtension(new URL("../", import.meta.url));
  if (!result.ok) { console.error(result.errors.map(item => `✗ ${item}`).join("\n")); process.exitCode = 1; }
  else console.log("✓ Manifest V3 配置有效\n✓ 所有入口文件存在\n✓ 未发现内联或远程脚本\n✓ 权限与 Chrome 版本符合要求");
}
