# TaskFlow frontends

- `web/`: The HTML client served at `http://localhost:8000/` by FastAPI.
- `mobile/`: Expo React Native client for iOS and Android.

## Run the mobile app

1. Start the API from the project root: `fastapi_venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000`.
2. In `frontends/mobile`, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your computer's LAN IP when using Expo Go on a physical phone.
3. Run `npm start`, then use Expo Go or an iOS simulator.

`localhost` works for an iOS simulator; a physical phone needs the LAN address and must be on the same network.
