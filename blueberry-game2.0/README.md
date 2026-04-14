# Blueberry Game Backend

## 已实现能力

1. 成绩提交接口：`POST /api/score`
2. 当日实时排行榜：`GET /api/rankings/today`
3. 每日结算前十：`POST /api/rankings/settle`
4. 已结算获奖名单：`GET /api/rankings/winners`
5. 健康检查：`GET /api/health`
6. 使用 JSON 文件存储，无需安装数据库
7. 提交成绩必须填写手机号
8. 排行榜显示脱敏手机号，如 `138****5678`
9. 同一手机号当天多次挑战，只保留最好成绩

## 排行规则

1. 按自然日统计，时区为 Asia/Shanghai
2. 用户可重复挑战
3. 同一手机号当天只取最好成绩
4. 排序规则：`used_seconds ASC, played_at ASC`
5. 只取前 10 名
6. 每天 0 点建议结算上一天榜单

## 数据文件

1. 排行数据文件：[data/rankings.json](file:///C:/Users/WM/lobsterai/project/blueberry-game/data/rankings.json)

## 运行方式

```bash
npm start
```

打开：`http://127.0.0.1:3000`

## 每日 0 点结算

手动执行：

```bash
npm run settle
```

默认会结算“昨天”的前十。

也可以指定日期：

```bash
node settle.js 2026-04-08
```

## 接口示例

### 提交成绩

```bash
curl -X POST http://127.0.0.1:3000/api/score \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"u001\",\"nickname\":\"小蓝\",\"phone\":\"13812345678\",\"usedSeconds\":58}"
```

### 查询当天排行榜

```bash
curl "http://127.0.0.1:3000/api/rankings/today?date=2026-04-08"
```

### 结算某天前十

```bash
curl -X POST http://127.0.0.1:3000/api/rankings/settle \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-04-08\"}"
```
