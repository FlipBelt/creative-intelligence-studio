# Synthetic Reference Mock（FBC-245）

仅本地合成元数据；独立于已有四工具 Mock，不联网、不调用真实 Pinterest/Apify、不写 DAM。所有输出固定 `synthetic=true`、真实 provider 未配置、平台资格未知、真实数据持久化未授权、无第三方处理/真实计费。权利状态一直 unknown，选择不代表人工审批或使用许可。

```sh
npm run test:reference
npm run mock:reference
```

stdio 客户端 command 为 node，args 为 `tools/mock-mcp/reference-stdio.mjs`，cwd 为仓库根目录。启动可加固定的 `--principal=mock_viewer`、`mock_anonymous` 等测试夹具；不是实际身份认证，调用输入不接受角色、租户或凭据。

## 工具

- `mock_create_reference_collection_job`：project_id、source_type（mock_keyword/mock_pin_url）、query_or_url、max_results（1–50）、budget_cap_usd、idempotency_key、failure_fixture。
- `mock_get_reference_collection_job`：project_id/job_id。
- `mock_list_external_references`：project_id/job_id、limit（1–20）、可选cursor。
- `mock_get_external_reference`：project_id/reference_id。
- `mock_select_references`：project_id/reference_ids、expected_revision、idempotency_key。
- `mock_delete_reference_collection_job`：project_id/job_id；清除内存引用与选择关系，不是备份恢复。

契约版本 `reference-mock-contract-v1`。固定 designer 使用 `mock_project_alpha`。所有数据纯内存，重启丢失；任务同步完成并标记 synchronous_fixture，没有伪造后台进度。

## 边界

同项目且同 owner 才能读取对象；这只是启动身份夹具，不验证真实服务端授权。游标绑定 owner/project/job。创建幂等键绑定全部输入；失败保持确定失败，删除后不复活。选择是替换集合、去重、乐观版本检查；幂等重放返回原快照，不能当最新状态。删除引用后相关重放拒绝。

mock_pin_url 仅词法接受 canonical HTTPS www.pinterest.com/pin/数字 路径，不抓取；keyword 字符串只是合成数据。结果 URL 使用 example.invalid。失败只返回固定错误码，不反射 query、凭据或异常细节。模拟金额不代表报价或真实账单。

实际采集/缓存/AI处理/入库仍须满足 [FBC-244 研究门禁](../../docs/research/fbc-244-pinterest-data-source-feasibility-2026-10-22.md)，不能把合成测试成功作为平台资格、素材许可或业务验收证据。
