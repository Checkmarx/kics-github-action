'use strict'

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'TRACE']

function finding(overrides = {}) {
    return {
        file_name: 'test/samples/positive1.tf',
        similarity_id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        line: 12,
        issue_type: 'MissingAttribute',
        search_key: 'aws_s3_bucket[bucket]',
        search_line: 12,
        search_value: '',
        expected_value: "'versioning' should be defined and enabled",
        actual_value: "'versioning' is undefined",
        ...overrides,
    }
}

function query(overrides = {}) {
    return {
        query_name: 'S3 Bucket Without Versioning',
        query_id: '568a4d22-3517-44a6-a7ad-6a7eed88722c',
        query_url: 'https://docs.kics.io/latest/queries/terraform-queries/aws/568a4d22-3517-44a6-a7ad-6a7eed88722c',
        severity: 'MEDIUM',
        platform: 'Terraform',
        cloud_provider: 'AWS',
        category: 'Backup',
        experimental: false,
        description: 'S3 bucket should have versioning enabled',
        description_id: '8c7c3a2b',
        files: [finding()],
        ...overrides,
    }
}

function defaultQueries() {
    return [
        query({
            files: [finding(), finding({ file_name: 'test/samples/positive2.tf', line: 3 })],
        }),
        query({
            query_name: 'Security Group With Unrestricted Ingress',
            query_id: '4728cd65-a20c-49da-8b31-9c08b423e4db',
            query_url: 'https://docs.kics.io/latest/queries/terraform-queries/aws/4728cd65-a20c-49da-8b31-9c08b423e4db',
            severity: 'HIGH',
            category: 'Networking and Firewall',
            description: 'Security group allows ingress from 0.0.0.0/0',
            files: [finding({ file_name: 'test/samples/positive2.tf', line: 30 })],
        }),
        query({
            query_name: 'Resource Without Tags',
            query_id: '0a3b9a1e-7a52-4b5b-8c1e-3f7e2f2f6a10',
            query_url: 'https://docs.kics.io/latest/queries/terraform-queries/aws/0a3b9a1e-7a52-4b5b-8c1e-3f7e2f2f6a10',
            severity: 'LOW',
            category: 'Best Practices',
            description: 'Resources should be tagged',
            files: [finding({ line: 45 })],
        }),
    ]
}

function kicsResults({ queries = defaultQueries(), ...overrides } = {}) {
    const severity_counters = Object.fromEntries(SEVERITIES.map((s) => [s, 0]))
    let total = 0
    for (const q of queries) {
        severity_counters[q.severity] += q.files.length
        total += q.files.length
    }
    return {
        kics_version: 'v2.1.20',
        files_scanned: 2,
        lines_scanned: 120,
        files_parsed: 2,
        lines_parsed: 120,
        lines_ignored: 0,
        files_failed_to_scan: 0,
        queries_total: 280,
        queries_failed_to_execute: 0,
        queries_failed_to_compute_similarity_id: 0,
        scan_id: 'console',
        severity_counters,
        total_counter: total,
        total_bom_resources: 0,
        start: '2026-03-01T10:00:00.123456+00:00',
        end: '2026-03-01T10:00:07.123456+00:00',
        paths: ['test/samples/positive1.tf', 'test/samples/positive2.tf'],
        queries,
        ...overrides,
    }
}

module.exports = { kicsResults, query, finding, SEVERITIES }
