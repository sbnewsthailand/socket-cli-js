/* eslint-disable no-console */

import chalk from 'chalk'
// @ts-ignore
import chalkTable from 'chalk-table'
import meow from 'meow'
import ora from 'ora'

import { outputFlags } from '../../flags/index.js'
import { handleApiCall, handleUnsuccessfulApiResponse } from '../../utils/api-helpers.js'
import { InputError } from '../../utils/errors.js'
import { printFlagList } from '../../utils/formatting.js'
import { getDefaultKey, setupSdk } from '../../utils/sdk.js'

/** @type {import('../../utils/meow-with-subcommands').CliSubcommand} */
export const metadata = {
  description: 'Get a scan\'s metadata',
  async run (argv, importMeta, { parentName }) {
    const name = parentName + ' metadata'

    const input = setupCommand(name, metadata.description, argv, importMeta)
    if (input) {
      const spinnerText = 'Getting scan\'s metadata... \n'
      const spinner = ora(spinnerText).start()
      await getOrgScanMetadata(input.orgSlug, input.scanID, spinner)
    }
  }
}

// Internal functions

/**
 * @typedef CommandContext
 * @property {boolean} outputJson
 * @property {boolean} outputMarkdown
 * @property {string} orgSlug
 * @property {string} scanID
 */

/**
 * @param {string} name
 * @param {string} description
 * @param {readonly string[]} argv
 * @param {ImportMeta} importMeta
 * @returns {void|CommandContext}
 */
function setupCommand (name, description, argv, importMeta) {
  const flags = {
    ...outputFlags,
  }

  const cli = meow(`
    Usage
      $ ${name} <org slug> <scan id>

    Options
      ${printFlagList(flags, 6)}

    Examples
      $ ${name} FakeOrg 000aaaa1-0000-0a0a-00a0-00a0000000a0
  `, {
    argv,
    description,
    importMeta,
    flags
  })

  const {
    json: outputJson,
    markdown: outputMarkdown,
  } = cli.flags

  if (cli.input.length < 2) {
    throw new InputError(`Please specify an organization slug and a scan id. \n
Example:
socket scan metadata FakeOrg 000aaaa1-0000-0a0a-00a0-00a0000000a0
`)
  }

  const [orgSlug = '', scanID = ''] = cli.input

  return {
    outputJson,
    outputMarkdown,
    orgSlug,
    scanID
  }
}

/**
 * @typedef FullScansData
 * @property {import('@socketsecurity/sdk').SocketSdkReturnType<'getOrgFullScanMetadata'>["data"]} data
 */

/**
 * @param {string} orgSlug
 * @param {string} scanId
 * @param {import('ora').Ora} spinner
 * @returns {Promise<void|FullScansData>}
 */
async function getOrgScanMetadata (orgSlug, scanId, spinner) {
  const socketSdk = await setupSdk(getDefaultKey())
  const result = await handleApiCall(socketSdk.getOrgFullScanMetadata(orgSlug, scanId), 'Listing scans')

  if (!result.success) {
    return handleUnsuccessfulApiResponse('getOrgFullScanMetadata', result, spinner)
  }
  spinner.stop()

  console.log(`\n Listing scans for: ${orgSlug} \n`)

  const options = {
    columns: [
      { field: 'id', name: chalk.magenta('ID') },
      { field: 'report_url', name: chalk.magenta('Scan URL') },
      { field: 'branch', name: chalk.magenta('Branch') },
      { field: 'created_at', name: chalk.magenta('Created at') }
    ]
  }

  // @ts-ignore
  const formattedResults = result.data.results.map(d => {
    return {
      id: d.id,
      report_url: chalk.underline(`${d.html_report_url}`),
      created_at: d.created_at ? new Date(d.created_at).toLocaleDateString('en-us', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
      branch: d.branch
    }
  })

  const table = chalkTable(options, formattedResults)

  console.log(table, '\n')

  return {
    data: result.data
  }
}