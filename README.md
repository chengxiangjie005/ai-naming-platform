# AI 起名平台

基于 Vercel Serverless Function + OpenAI 兼容接口 + Supabase 的 AI 起名应用：
输入起名需求，流式（SSE）输出 3 组名字与寓意，并把每次结果存入 Supabase 历史记录。

## 目录结构

```
.
├── api/
│   ├── name.js        # 起名接口：调用模型（流式）→ 写 Supabase
│   ├── models.js      # 模型列表接口（按环境变量判断是否可用）
│   └── history.js     # 历史记录查询接口
├── lib/
│   └── modelConfig.js # modelConfigMap：多模型配置表
├── index.html         # 前端页面（需求输入、模型下拉框、流式展示、历史列表）
├── schema.sql         # Supabase 建表 SQL
├── .env.example       # 环境变量模板（真实密钥放 .env，已在 .gitignore 中）
└── package.json
```

## 本地运行

```bash
npm install @supabase/supabase-js dotenv
cp .env.example .env      # 填入真实密钥
npm i -g vercel
vercel dev
```

打开 `http://localhost:3000`，输入需求（例如：男孩、国风、简约、姓李）即可看到名字逐字流出。

## 多模型配置

`lib/modelConfig.js` 中的 `modelConfigMap` 统一存放 4 个模型的 `baseURL / apiKey / model`，
后端只有一段 `streamChat()` 共用调用代码。新增模型 = 加一条配置 + 加一个环境变量，
不需要改动主调用逻辑。

| 模型 | 接口地址 |
| --- | --- |
| 豆包（火山方舟） | https://ark.cn-beijing.volces.com/api/v1 |
| DeepSeek | https://api.deepseek.com/v1 |
| 通义千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| Kimi | https://api.moonshot.cn/v1 |

## 数据库

在 Supabase → SQL Editor 执行 `schema.sql`。调试期可临时关闭 RLS，
正式上线请按 SQL 文件末尾注释的方案收紧权限（推荐读写都走服务端 service_role）。

## 部署

```bash
git push origin main          # 推送到 GitHub（.env 不会上传）
# Vercel 导入该仓库 → 在 Project Settings → Environment Variables 填入同样的变量 → Deploy
```
