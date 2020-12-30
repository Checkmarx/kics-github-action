# KICS Github Action ![kics](images/icon-32x32.png) <img src="images/github.png" alt="Github" width="40" height="40">

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL3.0-yellow.svg)](https://www.gnu.org/licenses)
[![Latest Release](https://img.shields.io/github/v/release/checkmarx/kics-github-action)](https://github.com/checkmarx/kics-github-action/releases)
[![Open Issues](https://img.shields.io/github/issues-raw/checkmarx/kics-github-action)](https://github.com/checkmarx/kics-github-action/issues)

## Integrate KICS into your GitHub workflows, using KICS Github Action to make your IaC more secured  

**KICS** (pronounced as 'kick-s') or **Kicscan** is an open source solution for static code analysis of Infrastructure as Code.

**K**eeping **I**nfrastructure as **C**ode **S**ecure (in short **KICS**) is a must-have for any cloud native project. With KICS, finding security vulnerabilities, compliance issues, and infrastructure misconfigurations happens early in the development cycle, when fixing these is straightforward and cheap.

It is as simple as running a CLI tool, making it easy to integrate into any project CI.

#### Supported Platforms

<img alt="Terraform" src="images/logo-terraform.png" width="150">&nbsp;&nbsp;&nbsp;<img alt="Kubernetes" src="images/logo-k8s.png" width="150">&nbsp;&nbsp;&nbsp;<img alt="Docker" src="images/logo-docker.png" width="150">&nbsp;&nbsp;&nbsp;<img alt="CloudFormation" src="images/logo-cf.png" width="150">&nbsp;&nbsp;&nbsp;<img alt="Ansible" src="images/logo-ansible.png" width="150">


###Please find more info in the official website: <a href="https://kics.io">kics.io</a>

## Inputs

| Variable  | Example Value &nbsp;| Description &nbsp; | Type | Required | Default |
| ------------- | ------------- | ------------- |------------- | ------------- | ------------- |
| path | terraform | path to file or directory to scan | String | Yes | N/A
| output_path | results.json | file path to store result in json format | String | No | N/A
| payload_path |  | file path to store source internal representation in JSON format | String | No | N/A
| queries |  | path to directory with queries (default "./assets/queries") | String | No | ./assets/queries downloaded with the binaries
| verbose | true | verbose scan | Boolean | No | false |



## Outputs

The default output format for this GitHub Action is a [SARIF](https://docs.github.com/en/github/finding-security-vulnerabilities-and-errors-in-your-code/sarif-support-for-code-scanning) output report stored in the working directory as **./cx.sarif**

For full documentation on all the supported output formats and defect management integration, please see the [following](https://github.com/checkmarx-ltd/cx-flow/wiki/Bug-Trackers-and-Feedback-Channels).  

## Example usage

```
    # Steps represent a sequence of tasks that will be executed as part of the job
    steps:
    # Checks-out your repository under $GITHUB_WORKSPACE, so your job can access it
    - uses: actions/checkout@v2
    # Scan Iac with kics
     - name: run kics Scan
        uses: checkmarx/kics-action@v1.0
        with:
          path: 'terraform'
          output_path: 'results.json'
	# Display the results in json format	  
     - name: display kics results
        run: |
          cat results.json
```
 

## How To Contribute

We welcome [issues](https://github.com/checkmarx/kics-github-action/issues) to and [pull requests](https://github.com/checkmarx/kics-github-action/pulls) against this repository!

# License

KICS Github Action

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.
