import axios from 'axios';

const MATCHING_SERVICE_URL = process.env.MATCHING_SERVICE_URL || 'http://localhost:3004';

/**
 * Trigger matching calculation for a job
 * Calls the Matching Service to calculate and store matches
 * This is called automatically when a job is published or updated
 */
export async function triggerMatchingCalculation(jobId: string, authToken: string): Promise<void> {
  try {
    console.log(`Triggering matching calculation for job ${jobId}...`);

    await axios.post(
      `${MATCHING_SERVICE_URL}/api/v1/matching/jobs/${jobId}/calculate`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log(`✓ Matching calculation completed for job ${jobId}`);
  } catch (error) {
    // Don't fail the job creation/update if matching fails
    // Just log the error and continue
    console.error(`Failed to calculate matches for job ${jobId}:`, error instanceof Error ? error.message : error);

    // If it's a timeout or network error, log it but don't throw
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.warn('Matching service is not available - matches will need to be calculated manually');
      } else if (error.code === 'ETIMEDOUT') {
        console.warn('Matching calculation timed out - this may indicate a large candidate pool');
      }
    }
  }
}
