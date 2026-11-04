"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyNameTokensMigration = applyNameTokensMigration;
const name_tokens_1 = require("../search/name-tokens");
// 외부 콘텐츠 FTS 에는 열을 더할 수 없어 트리거와 함께 다시 만듦. 값을 먼저 채우고 rebuild 해야 색인이 맞음
function applyNameTokensMigration(db) {
    db.exec(`
    DROP TRIGGER IF EXISTS nodes_ai;
    DROP TRIGGER IF EXISTS nodes_ad;
    DROP TRIGGER IF EXISTS nodes_au;
    DROP TABLE IF EXISTS nodes_fts;
  `);
    const columns = db.prepare('PRAGMA table_info(nodes)').all().map((row) => row.name);
    if (!columns.includes('name_tokens'))
        db.exec('ALTER TABLE nodes ADD COLUMN name_tokens TEXT');
    const update = db.prepare('UPDATE nodes SET name_tokens = ? WHERE rowid = ?');
    for (const row of db.prepare('SELECT rowid AS rid, name FROM nodes').all())
        update.run((0, name_tokens_1.nameTokens)(row.name), row.rid);
    db.exec(`
    CREATE VIRTUAL TABLE nodes_fts USING fts5(
      id, name, qualified_name, docstring, signature, name_tokens,
      content='nodes', content_rowid='rowid'
    );
    CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
    END;
    CREATE TRIGGER nodes_ad AFTER DELETE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
    END;
    CREATE TRIGGER nodes_au AFTER UPDATE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, OLD.docstring, OLD.signature, OLD.name_tokens);
      INSERT INTO nodes_fts(rowid, id, name, qualified_name, docstring, signature, name_tokens)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, NEW.docstring, NEW.signature, NEW.name_tokens);
    END;
    INSERT INTO nodes_fts(nodes_fts) VALUES ('rebuild');
  `);
}
