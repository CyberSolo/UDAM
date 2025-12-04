# Contributing to UDAM

Thank you for your interest in contributing to the Unified Data Marketplace! 🎉

## Ways to Contribute

### 🎨 UI/UX Improvements
The current frontend is intentionally minimal. We'd love contributions for:
- Design system / component library
- Responsive layouts
- Dark mode
- Accessibility improvements
- UI themes (templates people can choose from)

### 📚 Documentation
- Tutorial videos
- Use case examples
- Deployment guides (AWS, GCP, Azure, DigitalOcean)
- Translation (i18n)

### 🔒 Security
- Security audits
- Vulnerability reports (see SECURITY.md)
- Best practices documentation
- Penetration testing results

### 🧩 Integrations
- Additional payment providers (PayPal, Coinbase Commerce)
- OAuth providers (Google, GitHub, Twitter)
- Notification systems (email, SMS, webhooks)
- Analytics integrations

### 🐛 Bug Fixes
- Check [Issues](https://github.com/data-agent-marketplace/data-agent-marketplace/issues)
- Look for `good first issue` label
- Report new bugs you find

### ✨ Features
- Search and filtering
- User reviews/ratings
- Subscription models
- Multi-currency support
- Admin dashboard

---

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/data-agent-marketplace.git
cd data-agent-marketplace
```

### 2. Set Up Development Environment

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Start PostgreSQL
docker run --name udam-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16

# Configure backend (see README.md)
cd backend
export SESSION_SECRET="dev-secret"
export MARKETPLACE_MASTER_KEY="0000000000000000000000000000000000000000000000000000000000000000"
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
export SMALL_LIMIT=5
export FRONTEND_ORIGIN="http://localhost:3000"

npm run dev
```

### 3. Make Your Changes

- Create a new branch: `git checkout -b feature/your-feature-name`
- Write clear, commented code
- Follow existing code style
- Add tests if applicable

### 4. Test Your Changes

```bash
# Manual testing
# - Start backend and frontend
# - Test the feature in browser

# Run CI tests locally (if you have GitHub Actions CLI)
gh act -j build-and-health
```

### 5. Submit Pull Request

- Push your branch: `git push origin feature/your-feature-name`
- Open PR on GitHub
- Describe what you changed and why
- Link related issues

---

## Code Style

### Backend (Node.js)
- Use `async/await` over callbacks
- Prefer `const` over `let`
- Use descriptive variable names
- Add JSDoc comments for functions
- Handle errors explicitly

### Frontend (React/Next.js)
- Functional components over class components
- Use hooks appropriately
- Keep components small and focused
- PropTypes or TypeScript for type safety

### SQL
- Use parameterized queries (prevent SQL injection)
- Add indexes for performance
- Write migration scripts for schema changes

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user rating system
fix: resolve race condition in order processing
docs: update API documentation for new endpoint
style: format code with prettier
refactor: simplify token encryption logic
test: add E2E test for payment flow
chore: update dependencies
```

---

## Pull Request Guidelines

### Good PR Characteristics
- ✅ Single, focused change
- ✅ Clear title and description
- ✅ Tests pass (CI green)
- ✅ Documentation updated
- ✅ No unrelated changes

### PR Template

```markdown
## What does this PR do?
Brief description of the change

## Why is this needed?
Explain the problem or feature request

## How was it tested?
Manual testing steps or automated tests added

## Screenshots (if UI changes)
Before/after images

## Related Issues
Closes #123
```

---

## Issue Guidelines

### Bug Reports

Include:
- **Description:** What's wrong?
- **Steps to reproduce:** 1. Do X, 2. Do Y, 3. See error
- **Expected behavior:** What should happen?
- **Actual behavior:** What actually happens?
- **Environment:** OS, Node version, PostgreSQL version
- **Logs:** Error messages or stack traces

### Feature Requests

Include:
- **Problem:** What problem does this solve?
- **Proposed solution:** How should it work?
- **Alternatives considered:** Other ways to solve this?
- **Mockups:** Designs or wireframes (if UI feature)

---

## Communication

- **GitHub Issues:** Bug reports, feature requests
- **GitHub Discussions:** Questions, ideas, showcase
- **Pull Requests:** Code contributions
- **Email:** security@... (for security vulnerabilities only)

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation (for major contributions)

---

## Good First Issues

New to the project? Look for issues labeled:
- `good first issue` - Perfect for beginners
- `help wanted` - We need your expertise
- `documentation` - Improve docs

---

## Development Resources

- [API Documentation](API.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Launch Strategy](LAUNCH_STRATEGY.md)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Stripe API Reference](https://stripe.com/docs/api)

---

## Questions?

Don't hesitate to ask! Open a [Discussion](https://github.com/data-agent-marketplace/data-agent-marketplace/discussions) or comment on an issue.

We're here to help you contribute successfully. 🚀

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're building together.

**Not tolerated:**
- Harassment or discrimination
- Trolling or inflammatory comments
- Spamming or self-promotion
- Violating others' privacy

**Expected:**
- Respect differing opinions
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy toward other contributors

---

Thank you for making UDAM better! 💙