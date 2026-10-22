export interface CodeSnippetRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  contentType?: string;
}

export class CodeGenerator {
  /**
   * Generates a cURL command
   */
  public static toCurl(req: CodeSnippetRequest): string {
    const parts: string[] = ['curl --location'];
    parts.push(`--request ${req.method.toUpperCase()} '${req.url}'`);

    for (const [key, value] of Object.entries(req.headers || {})) {
      parts.push(`--header '${key}: ${value.replace(/'/g, "'\\''")}'`);
    }

    if (req.body && req.method.toUpperCase() !== 'GET' && req.method.toUpperCase() !== 'HEAD') {
      const escapedBody = req.body.replace(/'/g, "'\\''");
      parts.push(`--data '${escapedBody}'`);
    }

    return parts.join(' \\\n  ');
  }

  /**
   * Generates Node.js (Fetch API) code
   */
  public static toNodeFetch(req: CodeSnippetRequest): string {
    const headersJson = JSON.stringify(req.headers || {}, null, 2);
    const hasBody = req.body && req.method.toUpperCase() !== 'GET' && req.method.toUpperCase() !== 'HEAD';

    let bodyClause = '';
    if (hasBody) {
      if (req.contentType?.includes('application/json')) {
        bodyClause = `,\n  body: JSON.stringify(${req.body})`;
      } else {
        bodyClause = `,\n  body: ${JSON.stringify(req.body)}`;
      }
    }

    return `// Node.js (Fetch API - Node 18+)
const url = ${JSON.stringify(req.url)};
const options = {
  method: '${req.method.toUpperCase()}',
  headers: ${headersJson}${bodyClause}
};

async function executeRequest() {
  try {
    const response = await fetch(url, options);
    const data = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

executeRequest();`;
  }

  /**
   * Generates Python (requests) code
   */
  public static toPython(req: CodeSnippetRequest): string {
    const headersIndent = Object.entries(req.headers || {})
      .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(',\n');
    const headersStr = headersIndent ? `{\n${headersIndent}\n}` : '{}';

    const hasBody = req.body && req.method.toUpperCase() !== 'GET' && req.method.toUpperCase() !== 'HEAD';
    let dataClause = '';
    if (hasBody) {
      if (req.contentType?.includes('application/json')) {
        dataClause = `\npayload = ${req.body}\nresponse = requests.request("${req.method.toUpperCase()}", url, headers=headers, json=payload)`;
      } else {
        dataClause = `\npayload = ${JSON.stringify(req.body)}\nresponse = requests.request("${req.method.toUpperCase()}", url, headers=headers, data=payload)`;
      }
    } else {
      dataClause = `response = requests.request("${req.method.toUpperCase()}", url, headers=headers)`;
    }

    return `# Python 3 (requests)
import requests

url = ${JSON.stringify(req.url)}
headers = ${headersStr}
${dataClause}

print("Status:", response.status_code)
print("Response:", response.text)
`;
  }

  /**
   * Generates Java 11+ (java.net.http.HttpClient) code
   */
  public static toJava(req: CodeSnippetRequest): string {
    const hasBody = req.body && req.method.toUpperCase() !== 'GET' && req.method.toUpperCase() !== 'HEAD';
    const bodyPublisher = hasBody
      ? `HttpRequest.BodyPublishers.ofString(${JSON.stringify(req.body)})`
      : 'HttpRequest.BodyPublishers.noBody()';

    const headersLines = Object.entries(req.headers || {})
      .map(([k, v]) => `            .header(${JSON.stringify(k)}, ${JSON.stringify(v)})`)
      .join('\n');

    return `// Java 11+ java.net.http.HttpClient
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class AltmanRequest {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(${JSON.stringify(req.url)}))
            .method("${req.method.toUpperCase()}", ${bodyPublisher})
${headersLines ? headersLines + '\n' : ''}            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Status: " + response.statusCode());
        System.out.println("Response: " + response.body());
    }
}
`;
  }
}
