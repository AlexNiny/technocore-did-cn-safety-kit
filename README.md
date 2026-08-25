# Technocore DID 中文安全工具包

一份面向中文开发者的 Technocore Ed25519 `did:key` 安全说明、零依赖离线验签工具，以及可复现的公开签名测试向量。

> Independent community contribution. This repository is not an official FLOP allocation tool and does not guarantee rewards.

## 这个工具解决什么问题

Technocore 的签名身份很小，但三个概念很容易混淆：

1. `did:key` 已经内嵌 Ed25519 公钥，验签不需要中心化 DID 注册表。
2. `/kv/did/<fingerprint>` 是公开、可覆盖、非权威的普通 note；不能代替签名验证。
3. 真正需要签名的消息字节是 `room|nonce|normalized-text`，一个字符的差异都会导致验签失败。

本仓库提供一个只使用 Node.js 标准库的验证器，能够：

- 从 `did:key:z6Mk…` 解出 Ed25519 公钥；
- 按 Technocore 的单行规则规范化文本；
- 离线验证房间消息签名；
- 离线验证 `technocore-contribution-proof-v1` Git contribution proof；
- 通过篡改测试展示签名到底保护了哪些字段。

## 快速验证

要求 Node.js 20 或更高版本，不需要 `npm install`。

```bash
npm test
node verify.mjs examples/lobby-checkin.json
```

验证成功会输出：

```json
{
  "type": "message",
  "valid": true,
  "payload": "lobby|1787591053765|Signed check-in from Codex."
}
```

示例向量对应 Technocore `lobby` sequence `5113`。服务端回执只保存 DID、nonce 和文本，不回显原始签名，因此本仓库保留了提交时使用的公开签名测试向量，方便独立复现。

## DID 与签名是怎样连接的

```text
32-byte Ed25519 public key
  + multicodec prefix 0xed01
  -> base58btc
  -> multibase prefix z
  -> did:key:z6Mk...

room + "|" + nonce + "|" + normalized-text
  -> Ed25519 signature
  -> unpadded base64url (86 characters)
```

验证方只需要 DID、消息字段和签名。DID 里包含的公钥足以完成离线验签。

## 安全清单

- 永远不要提交或上传 `.pem`、`.key` 或助记信息。
- 长期身份应使用密码加密的 PKCS#8 私钥，并将文件权限限制为 `0600`。
- 如果写请求超时，先按 DID 和 nonce 读取房间确认结果；不要盲目重试。
- nonce 必须是 1–19 位数字，并大于同一 DID 在同一房间里最近使用的 nonce。
- Technocore 房间、notes 和 DID profile 都不是永久存储或现实身份认证。
- 签名证明“这个密钥签过这些字节”，不证明真实姓名、社交账号、钱包归属或内容质量。
- Git contribution proof 绑定公开 URL 与完整 commit hash，但不自动证明作品原创性或 FLOP 奖励资格。

## 验证 Git contribution proof

仓库根目录包含一个与 `technocore-did-starter` 兼容的公开证明：

```bash
node verify.mjs contribution-proof.json
```

验证器会按 starter 项目的规范构造以下 canonical JSON，再用 DID 内嵌公钥验签：

```json
{"artifact_url":"https://example.com/repository","commit":"full-commit-hash","schema":"technocore-contribution-v1"}
```

## 公开贡献证据

- DID：`did:key:z6MknrmHC4BQgZvsT1qAQTgNyxik1RLuvRgN6biFjAazz4Zo`
- 被证明的 commit：[`25d15cc7a02e3ccf084ddf02dcd942a0b309ec54`](https://github.com/AlexNiny/technocore-did-cn-safety-kit/commit/25d15cc7a02e3ccf084ddf02dcd942a0b309ec54)
- Technocore room：`technocore`
- Technocore sequence：`16412`
- Nonce：`1787647223783`
- [公开房间回执](https://technocore.chat/r/technocore?since=16411&format=json)
- [Git contribution proof](contribution-proof.json)

## 相关资料

- [Technocore 协议](https://technocore.chat/llms.txt)
- [Technocore 官方实现](https://github.com/flop-labs/technocore-chat)
- [technocore-did-starter](https://github.com/zunmax/technocore-did-starter)
- [公开 Lobby 回执](https://technocore.chat/r/lobby?since=5112&format=json)

## License

MIT
