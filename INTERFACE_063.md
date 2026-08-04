# SAP 接口文档 — ZSDR063 取数

> 供"订单进度台 — 量产交付监控"模块定时拉取使用。
> 配套调用脚本：`fetch_063.py`

## 1. 接口概要

| 项 | 值 |
|---|---|
| 用途 | 取 SAP 063 销售订单/交货相关数据 |
| 地址 | `https://po.kingfa.com.cn/RESTAdapter/Z_COM_SIO_MAXKB2ERP002` |
| 方法 | POST |
| 认证 | HTTP Basic Auth |
| Content-Type | `application/json` |
| 协议 | HTTPS（公司内网证书，调用端需跳过校验或导入 CA） |
| 类型标识 | `TYPE = "ZAIZSDR063"` |

## 2. 请求结构

外层固定两个字段，`INPUT` 为 JSON 字符串（注意是字符串，不是对象）：

```json
{
  "TYPE": "ZAIZSDR063",
  "INPUT": "{\"VKORG\":\"1000\",\"RTIME_S\":\"20260701\",\"RTIME_E\":\"20260803\",\"KUNNR\":\"\",\"VTWEG\":\"\"}"
}
```

### INPUT 字段

| 字段 | 含义 | 类型 | 格式 | 必填 | 示例 |
|---|---|---|---|---|---|
| VKORG | 销售组织 | string | 4位编码 | 是 | `1000` |
| RTIME_S | 查询起始日期 | string | `YYYYMMDD` | 是 | `20260701` |
| RTIME_E | 查询结束日期 | string | `YYYYMMDD` | 是 | `20260803` |
| KUNNR | 客户号 | string | — | 否（空=全部） | `0000100000` |
| VTWEG | 分销渠道 | string | — | 否（空=全部） | `10` |

### 日期格式兼容
`RTIME_S` / `RTIME_E` 接受三种输入，脚本会统一转成 `YYYYMMDD`：
- `YYYYMMDD`（如 `20260701`）
- `YYYY-MM-DD`（如 `2026-07-01`）
- `YYYY-MM-DD HH:mm:ss`（如 `2026-07-01 00:00:00`）

## 3. 响应结构

```json
{
  "OUTPUT": [ { ...订单记录... }, ... ]
}
```

- `OUTPUT` 为数组，每个元素为一条订单/交货记录
- 无数据时 `OUTPUT` 为 `null` 或空数组
- 字段全集以 SAP 实际返回为准（参考 CONTEXT.md §4.2 中 055 字段清单：过账日期、物料、工厂、售达方、销售订单、交货单、送货单号、是否按期交付、首个日期、在途天数 等）

## 4. 凭据管理

**禁止把明文密码写入代码或文档。** 统一走环境变量：

```bash
export ERP_USER="MAXKB_CONNECT_POP"
export ERP_PASS="********"
python3 fetch_063.py
```

`fetch_063.py` 通过 `os.environ.get("ERP_USER")` / `os.environ.get("ERP_PASS")` 读取，**未设置时直接拒绝调用**（返回错误提示）。本地运行前必须先 export。

## 5. 调用示例

```python
from fetch_063 import call

status, result = call(
    vkorg="1000",
    rtime_s="2026-07-01",
    rtime_e="2026-08-03",
    kunnr="",      # 空=全部客户
    vtweg="",      # 空=全部渠道
)
# status: HTTP 状态码；result: dict（成功）或 str（非 JSON 响应）
orders = result.get("OUTPUT") or []
```

## 6. 接入本地库的拉取策略

依 CONTEXT.md §9：定时拉取存本地库，仪表盘查本地库。

- 建议频率：每 15 分钟 ~ 每小时一次（待定）
- 拉取窗口：`RTIME_S = 今天-30天`，`RTIME_E = 今天`（覆盖在途/未结订单）
- 写入前按 `销售订单 + 交货单` 去重 upsert
- 业务员归属过滤仍走独立的 RPA 映射表（见 CONTEXT.md §3），不依赖本接口

## 7. 已知问题（联调记录）

2026-08-04 从远程沙箱联调时发现：
- 沙箱需走代理 `127.0.0.1:18080`（`https_proxy` 环境变量）
- 代理 CONNECT 阶段返回 `200 OK`，但到 `po.kingfa.com.cn:443` 的实际请求无响应体
- 偶尔 TLS 握手成功（可见 `*.kingfa.com.cn` 证书），POST 后仍无响应
- 多次重试 `http=000 size=0`，约 0.25s 即断
- Python 端偶发收到 `<!DOCTYPE html>`（网关拦截页，非合法 HTTP）

**判定为沙箱到内网的可达性问题，非接口/代码问题。** 在公司内网环境运行同一脚本即可。