import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cleanup video ads older than 14 days
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== VIDEO ADS CLEANUP STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    // Calculate 14 days ago
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const cutoffDate = fourteenDaysAgo.toISOString();
    
    console.log('Cutoff date:', cutoffDate);

    // Find video ads older than 14 days with video URLs
    const { data: expiredAds, error: fetchError } = await supabase
      .from('generated_ads')
      .select('id, user_id, generated_video_url')
      .lt('completed_at', cutoffDate)
      .not('generated_video_url', 'is', null)
      .eq('status', 'video_completed');

    if (fetchError) {
      console.error('Error fetching expired ads:', fetchError);
      throw fetchError;
    }

    if (!expiredAds || expiredAds.length === 0) {
      console.log('No expired video ads found');
      return new Response(
        JSON.stringify({ success: true, message: 'No expired video ads to clean up', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredAds.length} expired video ads to clean up`);

    let deletedCount = 0;
    const errors: string[] = [];

    for (const ad of expiredAds) {
      try {
        // Extract file path from URL
        const videoUrl = ad.generated_video_url;
        if (videoUrl && videoUrl.includes('generated-images')) {
          // Extract path after bucket name
          const pathMatch = videoUrl.match(/generated-images\/(.+)$/);
          if (pathMatch) {
            const filePath = pathMatch[1];
            console.log('Deleting video file:', filePath);

            // Delete from storage
            const { error: deleteStorageError } = await supabase.storage
              .from('generated-images')
              .remove([filePath]);

            if (deleteStorageError) {
              console.error('Error deleting video from storage:', deleteStorageError);
              errors.push(`Storage delete error for ${ad.id}: ${deleteStorageError.message}`);
            }
          }
        }

        // Update the ad record to clear the video URL
        const { error: updateError } = await supabase
          .from('generated_ads')
          .update({
            generated_video_url: null,
            status: 'video_expired',
          })
          .eq('id', ad.id);

        if (updateError) {
          console.error('Error updating ad record:', updateError);
          errors.push(`DB update error for ${ad.id}: ${updateError.message}`);
        } else {
          deletedCount++;
          console.log('Successfully cleaned up video ad:', ad.id);
        }
      } catch (adError) {
        console.error('Error processing ad:', ad.id, adError);
        errors.push(`Processing error for ${ad.id}: ${adError instanceof Error ? adError.message : 'Unknown error'}`);
      }
    }

    console.log(`Cleanup complete. Deleted: ${deletedCount}/${expiredAds.length}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${deletedCount} expired video ads`,
        count: deletedCount,
        total: expiredAds.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cleanup-video-ads:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
