#!/bin/bash

# ============================================================================
# Complete Deployment Script for Supabase
# ============================================================================
# This script deploys the complete authentication platform to Supabase
# ============================================================================

set -e  # Exit on error

echo "============================================================================"
echo "  Bolt Authentication Platform - Supabase Deployment"
echo "============================================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Logging in..."
    supabase login
fi

echo -e "${GREEN}✓ Logged in to Supabase${NC}"
echo ""

# Step 1: Database Setup
echo "============================================================================"
echo "Step 1: Database Setup"
echo "============================================================================"
echo ""
echo "Please import the database manually:"
echo "1. Go to your Supabase Dashboard → SQL Editor"
echo "2. Copy content from: complete_database_export.sql"
echo "3. Execute the script"
echo ""
read -p "Press Enter when database is imported..."
echo -e "${GREEN}✓ Database imported${NC}"
echo ""

# Step 2: Configure Secrets
echo "============================================================================"
echo "Step 2: Configure Secrets"
echo "============================================================================"
echo ""
echo "Setting up dLocal credentials..."

supabase secrets set DLOCAL_API_KEY=QPTeRLXfFKyFNhXeQHPxFIglfMmlMEMo
supabase secrets set DLOCAL_SECRET_KEY=nqlmlTAsTAg61cvl4UCw7lUrcbOyx0tSI3waCkMA
supabase secrets set DLOCAL_API_URL=https://api-sbx.dlocalgo.com

echo -e "${GREEN}✓ Secrets configured${NC}"
echo ""

# Step 3: Deploy Edge Functions
echo "============================================================================"
echo "Step 3: Deploy Edge Functions"
echo "============================================================================"
echo ""

FUNCTIONS=(
  "auth-login"
  "auth-register"
  "auth-reset-password"
  "auth-reset-password-confirm"
  "check-ip-status"
  "debug-email-config"
  "debug-env-vars"
  "send-email"
  "sync-dlocal-plans"
  "sync-dlocal-subscriptions"
  "test-dlocal-auth"
)

FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
  echo "Deploying: $func"
  if supabase functions deploy "$func" --no-verify-jwt 2>&1; then
    echo -e "${GREEN}✅ $func deployed${NC}"
  else
    echo -e "${RED}❌ Failed to deploy $func${NC}"
    FAILED_FUNCTIONS+=("$func")
  fi
  echo ""
done

# Step 4: Summary
echo "============================================================================"
echo "Deployment Summary"
echo "============================================================================"
echo ""

if [ ${#FAILED_FUNCTIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All functions deployed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some functions failed:${NC}"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  - $func"
    done
fi

echo ""
echo "Next steps:"
echo "1. Test authentication: curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/test-dlocal-auth"
echo "2. Sync dLocal plans: curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-dlocal-plans"
echo "3. Update frontend .env with your Supabase credentials"
echo ""
echo "For detailed instructions, see: DEPLOYMENT_GUIDE.md"
echo ""
echo "============================================================================"
echo "Deployment Complete!"
echo "============================================================================"
