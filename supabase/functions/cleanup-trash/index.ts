import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retention period in days - ads in trash older than this will be permanently deleted
const RETENTION_DAYS = 14;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Starting trash cleanup job...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role key to bypass RLS for cleanup
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (14 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISOString = cutoffDate.toISOString();

    console.log(`Deleting ads in trash older than ${RETENTION_DAYS} days (before ${cutoffISOString})`);

    // First, get the count of ads to be deleted for logging
    const { data: adsToDelete, error: countError } = await supabase
      .from('generated_ads')
      .select('id, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffISOString);

    if (countError) {
      console.error('Error counting ads to delete:', countError);
      throw countError;
    }

    const count = adsToDelete?.length || 0;
    console.log(`Found ${count} ads to permanently delete`);

    if (count === 0) {
      console.log('No ads to delete. Cleanup complete.');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No ads to delete',
          deletedCount: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Log the IDs being deleted for audit purposes
    console.log('Deleting ad IDs:', adsToDelete?.map(ad => ad.id));

    // Permanently delete the ads
    const { error: deleteError } = await supabase
      .from('generated_ads')
      .delete()
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffISOString);

    if (deleteError) {
      console.error('Error deleting ads:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${count} ads from trash`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Permanently deleted ${count} ads from trash`,
        deletedCount: count,
        cutoffDate: cutoffISOString
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Trash cleanup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
