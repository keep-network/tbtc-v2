-- Migration number: 0000 	 2024-03-19T14:35:39.927Z

CREATE TABLE IF NOT EXISTS reveals (
  address TEXT,
  reveal_info JSON,
  metadata JSON,
  application TEXT,
  inserted_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);
