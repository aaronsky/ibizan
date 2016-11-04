import 'mocha';
const { expect } = require('chai');

import { Rows } from '../../shared/rows';
import { Project } from '../project';

const TEST_ROW = new Rows.ProjectsRow(['#production', '1/1/2014', '100'], '');
const BAD_ROW = new Rows.ProjectsRow(['#production', '1/1/2014', 'jeff'], '');

describe('Project', () => {
  describe('.parse(row)', () => {
    it('should return undefined when a row is not provided', () => {
      const project = Project.parse(null);
      expect(project).to.not.exist;
    });
    it('should return a project when passed a row', () => {
      const project = Project.parse(TEST_ROW);
      expect(project).to.have.property('name', 'production');
      expect(project).to.have.property('start');
      expect(project).to.have.property('total', 100);
    });
    it('should handle bad data gracefully', () => {
      const project = Project.parse(BAD_ROW);
      expect(project).to.have.property('name', 'production');
      expect(project).to.have.property('start');
      expect(project).to.have.property('total', 0);
    });
  });
  describe('#updateRow()', () => {

  });
  describe('#description()', () => {
    it('should return a description of the project for output', () => {
      const description = Project.parse(TEST_ROW).description();
      expect(description).to.exist;
    })
  });
});
