# Make.com Automated DM Tracking Setup

This guide shows you how to automatically capture Instagram and Facebook DMs using Make.com and send them to your Social Spark Tracker.

---

## 🎯 **What This Does**

When someone sends you a DM on Instagram or Facebook:
1. Make.com captures it instantly
2. Sends it to your app's webhook
3. Appears automatically in your DM Pipeline
4. No manual entry needed!

---

## 📋 **Prerequisites**

1. **Make.com account** (free tier works fine)
   - Sign up at: https://www.make.com/en/register
   - Free plan: 1,000 operations/month

2. **Your Supabase User ID**
   - Go to: https://social.masonvanmeter.com/settings
   - Open browser console (F12)
   - Type: `supabase.auth.getUser()` and press Enter
   - Copy the `id` value (looks like: `e754b749-11b6-4c4b-8076-4d3c3d3db81e`)

3. **Webhook URL** (already set up for you):
   ```
   https://tkavzevkgavcxsvtizlu.supabase.co/functions/v1/dm-webhook
   ```

---

## 🚀 **Step-by-Step Setup**

### **Step 1: Create Instagram DM Automation**

1. **Login to Make.com**: https://www.make.com/en/login

2. **Create New Scenario**:
   - Click **"Create a new scenario"**
   - Name it: "Instagram DM Tracker"

3. **Add Instagram Trigger**:
   - Click the **+** button
   - Search for **"Instagram for Business"**
   - Select trigger: **"Watch Messages"** or **"New Direct Message"**
   - Click **"Create a connection"** and authorize your Instagram Business account
   - Set to check for new messages (every 15 minutes recommended)

4. **Add HTTP Request Module**:
   - Click **+** after the Instagram module
   - Search for **"HTTP"**
   - Select **"Make a request"**
   - Configure:
     - **URL**: `https://tkavzevkgavcxsvtizlu.supabase.co/functions/v1/dm-webhook`
     - **Method**: `POST`
     - **Headers**:
       - `Content-Type`: `application/json`
       - `apikey`: (Get from Supabase dashboard → Settings → API → anon public key)
       - `Authorization`: `Bearer [YOUR_SUPABASE_ANON_KEY]` (same anon key)
     - **Body type**: `Raw`
     - **Content type**: `JSON (application/json)`
     - **Request content**:
       ```json
       {
         "platform": "instagram",
         "sender_username": "{{1.username}}",
         "sender_name": "{{1.name}}",
         "message_text": "{{1.text}}",
         "message_id": "{{1.id}}",
         "conversation_id": "{{1.conversation_id}}",
         "timestamp": "{{1.timestamp}}",
         "user_id": "YOUR_SUPABASE_USER_ID"
       }
       ```
       **Replace `YOUR_SUPABASE_USER_ID` with your actual user ID from Prerequisites step 2**

5. **Save and Activate**:
   - Click **"OK"**
   - Toggle the switch to **ON** (activate scenario)
   - Click **"Run once"** to test

---

### **Step 2: Create Facebook DM Automation** (Optional)

Repeat the exact same steps but:
- Use **"Facebook Pages"** or **"Facebook Messenger"** module instead
- Change `"platform": "facebook"` in the JSON body
- Name the scenario: "Facebook DM Tracker"

---

### **Step 3: Get Your Supabase Keys**

1. Go to: https://supabase.com/dashboard/project/tkavzevkgavcxsvtizlu
2. Click **"Settings"** → **"API"**
3. Copy:
   - **Project URL**: `https://tkavzevkgavcxsvtizlu.supabase.co`
   - **anon public key**: (starts with `eyJhbG...`)

---

## ✅ **Testing the Integration**

### **Test 1: Send Yourself a DM**
1. Send a DM to your Instagram Business account
2. Wait ~1 minute for Make.com to check
3. Go to: https://social.masonvanmeter.com/dm-pipeline
4. Click the **"Automated DMs"** tab
5. Your DM should appear!

### **Test 2: Manual Trigger**
1. In Make.com, click **"Run once"**
2. It will fetch your recent DMs
3. Check your dashboard

---

## 🔧 **Troubleshooting**

### **DMs Not Appearing?**

**Check Make.com Execution History:**
1. Go to your scenario
2. Click **"History"** tab
3. Look for errors

**Common Issues:**

1. **401 Unauthorized**:
   - Check your Supabase API key is correct
   - Make sure `apikey` header is set
   - Verify `Authorization` header format: `Bearer [key]`

2. **400 Bad Request - Missing Fields**:
   - Check all required fields are mapped:
     - `platform`
     - `sender_username`
     - `message_text`
     - `timestamp`
     - `user_id`
   - Verify user_id is YOUR actual Supabase user ID

3. **Instagram Not Connecting**:
   - Make sure your Instagram is a **Business** or **Creator** account
   - Verify it's connected to a Facebook Page
   - Check permissions in Facebook Business Suite

4. **DMs Appear Multiple Times**:
   - Make.com might be re-processing old messages
   - Add a filter to only process messages from last 24 hours

---

## 📊 **Field Mapping Reference**

| Make.com Field | JSON Field | Description |
|---|---|---|
| Instagram username | `sender_username` | @username of sender |
| Name | `sender_name` | Display name |
| Message text | `message_text` | The DM content |
| Message ID | `message_id` | Platform message ID |
| Conversation ID | `conversation_id` | Thread ID |
| Timestamp | `timestamp` | When message was sent |
| (hardcoded) | `platform` | "instagram" or "facebook" |
| (hardcoded) | `user_id` | Your Supabase user ID |

---

## 💡 **Advanced: Add Filters**

To avoid processing spam or old messages:

1. Add **"Filter"** module between Instagram and HTTP modules
2. Set condition:
   - `timestamp` greater than `{{now - 24 hours}}`
   - Or filter by specific keywords
   - Or filter by sender

---

## 🎉 **You're Done!**

Your DMs will now automatically appear in your DM Pipeline!

### **What to Do Next:**
1. Go to https://social.masonvanmeter.com/dm-pipeline
2. Click **"Automated DMs"** tab
3. Mark DMs as "Responded" or "Archived" as you handle them
4. Track your response rates and conversion!

---

## 💰 **Make.com Free Tier Limits**

- **1,000 operations/month**
- Each DM = 2 operations (1 Instagram trigger + 1 HTTP request)
- ~500 DMs/month on free tier
- Upgrade to Pro ($9/month) for 10,000 operations

---

## 🔒 **Security Note**

Your Supabase API key is public (anon key) and Row Level Security ensures users can only see their own DMs. However, if you want extra security:

1. In Supabase, go to **Edge Functions** → **dm-webhook**
2. Add environment variable: `WEBHOOK_SECRET=your_random_secret`
3. In Make.com HTTP module, add header:
   - `x-webhook-secret`: `your_random_secret`

---

## 📞 **Need Help?**

If something isn't working:
1. Check Make.com execution history for errors
2. Check browser console on your dashboard (F12)
3. Verify your Instagram is Business/Creator account
4. Make sure user_id matches your actual Supabase user ID
