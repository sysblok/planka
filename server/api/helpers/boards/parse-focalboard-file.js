/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const fs = require('fs');
const { rimraf } = require('rimraf');
const readline = require('readline');

/**
 * @description :: Parses a Focalboard JSONL export file and returns structured data.
 *                 Used by both preview endpoint and import flow.
 */

module.exports = {
  inputs: {
    file: {
      type: 'json',
      required: true,
      description: 'Uploaded file object with fd (file descriptor)',
    },
  },

  exits: {
    invalidFile: {},
  },

  async fn(inputs) {
    console.log('');
    console.log('=== Parsing Focalboard JSONL File ===');

    const fileStream = fs.createReadStream(inputs.file.fd);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const data = {
      board: null,
      views: [],
      cards: [],
      textBlocks: [],
    };

    let lineCount = 0;
    let emptyLines = 0;
    let parseErrors = 0;
    const unknownBlockTypes = new Set();

    try {
      for await (const line of rl) {
        lineCount++;

        if (!line.trim()) {
          emptyLines++;
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch (error) {
          parseErrors++;
          console.warn(`Parse error on line ${lineCount}: ${error.message}`);
          await rimraf(inputs.file.fd);
          throw 'invalidFile';
        }

        // Focalboard exports have two formats:
        // 1. Board: {"type":"board","data":{...}}
        // 2. Blocks: {"type":"block","data":{...}}

        let block;
        if (parsed.type === 'board' && parsed.data) {
          block = parsed.data;
          data.board = block;
          console.log(`Found board: "${block.title}"`);
          continue;
        } else if (parsed.type === 'block' && parsed.data) {
          block = parsed.data;
        } else {
          console.warn(`Skipping line ${lineCount}: not a valid structure (type: ${parsed.type})`);
          continue;
        }

        switch (block.type) {
          case 'board':
            data.board = block;
            console.log(`Found board: "${block.title}"`);
            break;
          case 'view':
            data.views.push(block);
            console.log(`Found view: "${block.title}" (type: ${block.fields?.viewType || 'unknown'})`);
            break;
          case 'card':
            data.cards.push(block);
            break;
          case 'text':
            data.textBlocks.push(block);
            break;
          default:
            unknownBlockTypes.add(block.type);
            break;
        }
      }
    } catch (error) {
      await rimraf(inputs.file.fd);
      if (error === 'invalidFile') {
        throw error;
      }
      console.error('Unexpected error:', error);
      throw 'invalidFile';
    }

    await rimraf(inputs.file.fd);

    console.log('');
    console.log('--- Parsing Summary ---');
    console.log(`Total lines: ${lineCount}`);
    console.log(`Empty lines: ${emptyLines}`);
    console.log(`Board: ${data.board ? data.board.title : 'NOT FOUND'}`);
    console.log(`Views: ${data.views.length}`);
    console.log(`Cards: ${data.cards.length}`);
    console.log(`Text blocks: ${data.textBlocks.length}`);

    if (unknownBlockTypes.size > 0) {
      console.log(`Unknown block types (ignored): ${Array.from(unknownBlockTypes).join(', ')}`);
    }

    if (parseErrors > 0) {
      console.warn(`Parse errors: ${parseErrors}`);
    }

    // Validate minimum required data
    if (!data.board) {
      console.error('ERROR: No board block found');
      throw 'invalidFile';
    }

    if (data.views.length === 0) {
      console.error('ERROR: No view blocks found');
      throw 'invalidFile';
    }

    if (data.cards.length === 0) {
      console.error('ERROR: No card blocks found');
      throw 'invalidFile';
    }

    console.log('✓ File parsed successfully');
    console.log('');

    return data;
  },
}
