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
    previewOnly: {
      type: 'boolean',
      defaultsTo: false,
      description: 'If true, only parse board and views (faster for preview)',
    },
  },

  exits: {
    invalidFile: {},
  },

  async fn(inputs) {
    console.log('');
    console.log('=== Parsing Focalboard JSONL File ===');
    const { previewOnly } = inputs;

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
      boardMembers: [],
      users: [],
    };

    let lineCount = 0;
    let emptyLines = 0;
    let parseErrors = 0;
    let cardCount = 0;
    let textBlockCount = 0;
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

        if (!parsed.data) continue;

        switch (parsed.type) {
          case 'board':
            data.board = parsed.data;
            console.log(`Found board: "${parsed.data.title}"`);
            continue;
          case 'boardMember':
            data.boardMembers.push(parsed.data);
            continue;
          case 'user':
            data.users.push(parsed.data);
            continue;
          case 'block':
            break; // fall through to block-type switch below
          default:
            continue;
        }

        // Handle block subtypes
        switch (parsed.data.type) {
          case 'view':
            data.views.push(parsed.data);
            break;
          case 'card':
            if (previewOnly) { cardCount++; } else { data.cards.push(parsed.data); }
            break;
          case 'text':
            if (previewOnly) { textBlockCount++; } else { data.textBlocks.push(parsed.data); }
            break;
          default:
            unknownBlockTypes.add(parsed.data.type);
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
    console.log(`Board members: ${data.boardMembers.length}`);
    console.log(`Users: ${data.users.length}`);

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

    // For full parsing, validate cards exist
    if (!previewOnly && data.cards.length === 0) {
      throw 'invalidFile';
    }

    // In preview mode, add counts to data
    if (previewOnly) {
      data.cardCount = cardCount;
      data.textBlockCount = textBlockCount;
    }

    console.log('✓ File parsed successfully');
    console.log('');

    return data;
  },
}
