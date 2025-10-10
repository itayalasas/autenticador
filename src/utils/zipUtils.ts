// Utility to create ZIP files for deployment

export async function createZipFromFiles(files: Map<string, Blob | string>): Promise<Blob> {
  // Use JSZip library if available, otherwise create a simple implementation
  // For now, we'll use a dynamic import approach

  try {
    // Try to use JSZip if available
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Add all files to the zip
    for (const [path, content] of files.entries()) {
      if (content instanceof Blob) {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }

    // Generate the zip file
    return await zip.generateAsync({ type: 'blob' });
  } catch (error) {
    console.error('JSZip not available, using fallback method');
    throw new Error('ZIP creation failed: JSZip library not available');
  }
}

export async function downloadProjectAsZip(projectPath: string = '/tmp/cc-agent/58162069/project/dist'): Promise<Blob> {
  // This function will be called to create a ZIP of the dist folder
  // In a browser environment, we'll need to fetch the files first

  throw new Error('This function should be called from the backend');
}

// Helper to collect files from dist directory
export async function collectDistFiles(): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  // This would need to be implemented based on how we access the file system
  // For now, we'll return an empty map and implement this when we have access to the files

  return files;
}
