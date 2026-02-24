import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook secret (optional security)
    const webhookSecret = req.headers.get('x-webhook-secret')
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET')

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the webhook payload from Make.com
    const payload = await req.json()

    // Extract DM data
    const {
      platform,           // 'instagram' or 'facebook'
      sender_username,    // @username
      sender_name,        // Display name
      message_text,       // Message content
      message_id,         // Platform message ID
      conversation_id,    // Thread/conversation ID
      timestamp,          // When message was sent
      user_id             // Your Supabase user ID (you'll include this in Make.com)
    } = payload

    // Validate required fields
    if (!platform || !sender_username || !message_text || !timestamp || !user_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['platform', 'sender_username', 'message_text', 'timestamp', 'user_id']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert DM into database
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
      JSON.stringify({
        success: true,
        message: 'DM received and saved',
        data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
