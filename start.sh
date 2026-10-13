#!/bin/bash
# MPUZA startup script
cd /workspaces/Mpuza

echo "Setting up environment..."
if [ ! -f server/.env ]; then
  echo "⚠️  No .env file found. Copying .env.example as a template."
  cp server/.env.example server/.env
  echo "   Please edit server/.env and add your Supabase credentials."
fi

echo "Starting MPUZA backend..."
node server/index.js

