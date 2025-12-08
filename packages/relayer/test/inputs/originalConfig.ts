export const originalConfig = {
  "defaults": {
    "fee_receiver_address": "0x1212121212121212121212121212121212121212",
    "entrypoint_address": "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
    "signer_private_key": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  },
  "chains": [
    {
      "chain_id": 31337,
      "chain_name": "localhost",
      "rpc_url": "http://localhost:8545",
      "max_gas_price": "5000000000",
      "supported_assets": [
        {
          "asset_address": "0x1111111111111111111111111111111111111111",
          "asset_name": "TEST",
          "fee_bps": "1000",
          "min_withdraw_amount": "200"
        }
      ]
    }
  ],
  "sqlite_db_path": ":memory:",
  "allowed_domains": ["http://localhost:3000"],
  "cors_allow_all": true
};