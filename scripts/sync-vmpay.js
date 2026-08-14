import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VMPAY_API_KEY = process.env.VMPAY_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VMPAY_API_KEY) {
  console.error("Missing environment variables. Make sure secrets are set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function syncClients() {
  try {
    console.log("Fetching clients from VMPay...");
    const response = await fetch("https://api.vmpay.com.br/api/v1/clients", {
      headers: {
        "Authorization": `Bearer ${VMPAY_API_KEY}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`VMPay API Error: ${response.statusText}`);
    }

    const clients = await response.json();
    console.log(`Fetched ${clients.length} clients. Syncing to Supabase...`);

    for (const client of clients) {
      if (!client.contact_email) continue;
      
      const { error } = await supabase
        .from('authorized_emails')
        .upsert({
          contact_email: client.contact_email,
          main_location_id: client.main_location_id,
          role: 'Síndico'
        }, { onConflict: 'contact_email' });

      if (error) {
        console.error(`Error upserting ${client.contact_email}:`, error.message);
      } else {
        console.log(`Successfully upserted: ${client.contact_email}`);
      }
    }
    
    console.log("Sync completed successfully.");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

syncClients();
