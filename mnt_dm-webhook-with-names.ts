import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-hub-signature',
}

const VERIFY_TOKEN = 'social_spark_tracker_2024'

// You'll need to set this in Supabase Edge Function secrets
// Get it from Facebook App Dashboard → Messenger → Settings → Access Tokens
const PAGE_ACCESS_TOKEN = Deno.env.get('FB_PAGE_ACCESS_TOKEN')

async function getSenderInfo(senderId: string) {
  if (!PAGE_ACCESS_TOKEN) {
    return { name: `Facebook User ${senderId.substring(0, 8)}`, username: senderId }
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${senderId}?fields=name,first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`
    )
    const data = await response.json()

    if (data.name) {
      return { name: data.name, username: senderId }
    }
  } catch (error) {
    console.error('Error fetching sender info:', error)
  }

  return { name: `Facebook User ${senderId.substring(0, 8)}`, username: senderId }
}

serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle Facebook webhook verification (GET request)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified!')
      return new Response(challenge, { status: 200 })
    } else {
      console.error('Verification failed')
      return new Response('Forbidden', { status: 403 })
    }
  }

  // Handle webhook events (POST request)
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      // Facebook/Instagram webhook format
      if (body.object === 'page' || body.object === 'instagram') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get the first user ID from database (single-user app)
        const { data: users } = await supabase
          .from('automated_dms')
          .select('user_id')
          .limit(1)

        // If no users found, try to get from auth.users
        let userId = users?.[0]?.user_id
        if (!userId) {
          const { data: authUsers } = await supabase.auth.admin.listUsers()
          userId = authUsers?.users?.[0]?.id
        }

        if (!userId) {
          console.error('No user found in database')
          return new Response(JSON.stringify({ error: 'No user configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Process each entry in the webhook
        for (const entry of body.entry) {
          // Handle Facebook Messenger messages
          if (entry.messaging) {
            for (const event of entry.messaging) {
              if (event.message && !event.message.is_echo) {
                const senderId = event.sender.id
                const messageText = event.message.text || '[Media/Attachment]'
                const messageId = event.message.mid
                const timestamp = new Date(event.timestamp).toISOString()

                // Fetch sender's actual name from Facebook
                const senderInfo = await getSenderInfo(senderId)

                await supabase.from('automated_dms').insert({
                  user_id: userId,
                  platform: 'facebook',
                  sender_username: senderInfo.username,
                  sender_name: senderInfo.name,
                  message_text: messageText,
                  message_id: messageId,
                  conversation_id: senderId,
                  timestamp: timestamp,
                  status: 'new'
                })
              }
            }
          }

          // Handle Instagram messages
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === 'messages' && change.value.message) {
                const message = change.value.message
                const senderId = change.value.from?.id || 'unknown'
                const senderUsername = change.value.from?.username || senderId
                const messageText = message.text || '[Media/Attachment]'
                const messageId = message.mid
                const timestamp = new Date(message.timestamp || Date.now()).toISOString()

                await supabase.from('automated_dms').insert({
                  user_id: userId,
                  platform: 'instagram',
                  sender_username: senderUsername,
                  sender_name: senderUsername,
                  message_text: messageText,
                  message_id: messageId,
                  conversation_id: senderId,
                  timestamp: timestamp,
                  status: 'new'
                })
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fallback: Handle Make.com format (original)
      const {
        platform,
        sender_username,
        sender_name,
        message_text,
        message_id,
        conversation_id,
        timestamp,
        user_id
      } = body

      if (platform && sender_username && message_text && timestamp && user_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data, error } = await supabase
          .from('automated_dms')
          .insert({
            user_id,
            platform,
            sender_username,
            sender_name,
            message_text,
            message_id,
            conversation_id,
            timestamp: new Date(timestamp).toISOString(),
            status: 'new'
          })
          .select()
          .single()

        if (error) {
          console.error('Database error:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to save DM', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'DM received and saved', data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      console.error('Webhook error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
