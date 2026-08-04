#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZSDR063 取数接口调用（stdlib only）

用途：从 SAP 063 取销售/交货相关数据，供"量产交付监控"模块本地库拉取。
凭据从环境变量 ERP_USER / ERP_PASS 读取，避免硬编码。

用法：
    ERP_USER=xxx ERP_PASS=yyy python3 fetch_063.py
或直接运行（使用脚本内默认值，仅用于联调）。
"""
import base64
import json
import os
import ssl
from datetime import datetime
from urllib import request, error

URL = os.environ.get("ERP_URL", "https://po.kingfa.com.cn/RESTAdapter/Z_COM_SIO_MAXKB2ERP002")
ENV_USER = os.environ.get("ERP_USER")
ENV_PASS = os.environ.get("ERP_PASS")

# 公司内网证书，跳过校验（生产建议导入 CA）
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def format_erp_date(date_str: str) -> str:
    """支持 YYYYMMDD / YYYY-MM-DD / YYYY-MM-DD HH:mm:ss，统一输出 YYYYMMDD。"""
    if date_str.isdigit() and len(date_str) == 8:
        datetime.strptime(date_str, "%Y%m%d")
        return date_str
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y%m%d")
        except ValueError:
            continue
    raise ValueError(f"日期格式错误: {date_str}，需 YYYYMMDD / YYYY-MM-DD / YYYY-MM-DD HH:mm:ss")


def build_body(vkorg, rtime_s, rtime_e, kunnr="", vtweg=""):
    payload = {
        "VKORG": vkorg,
        "RTIME_S": format_erp_date(rtime_s),
        "RTIME_E": format_erp_date(rtime_e),
        "KUNNR": kunnr,
        "VTWEG": vtweg,
    }
    return {"TYPE": "ZAIZSDR063", "INPUT": json.dumps(payload, ensure_ascii=False)}


def call(vkorg, rtime_s, rtime_e, kunnr="", vtweg="", timeout=60):
    """调用接口，返回 (status, data_or_text)。成功时 data 为解析后的 JSON。"""
    if not ENV_USER or not ENV_PASS:
        return 0, "缺少凭据：请设置环境变量 ERP_USER / ERP_PASS"
    body = build_body(vkorg, rtime_s, rtime_e, kunnr, vtweg)
    data = json.dumps(body).encode("utf-8")
    token = base64.b64encode(f"{ENV_USER}:{ENV_PASS}".encode()).decode()
    req = request.Request(URL, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Basic {token}")

    try:
        with request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8", errors="replace")
    except error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, f"请求异常: {e!r}"

    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


if __name__ == "__main__":
    # 示例：销售组织 1000，近一个月
    status, result = call(vkorg="1000", rtime_s="2026-07-01", rtime_e="2026-08-03")
    print("HTTP:", status)
    if isinstance(result, dict):
        out = result.get("OUTPUT")
        print("OUTPUT 类型:", type(out).__name__,
              "长度:", len(out) if hasattr(out, "__len__") else "N/A")
        print(json.dumps(out[:2] if isinstance(out, list) else out,
                         ensure_ascii=False, indent=2)[:2000])
    else:
        print("响应（非 JSON）前 1000 字符:")
        print(str(result)[:1000])