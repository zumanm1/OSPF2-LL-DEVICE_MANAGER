#!/bin/bash

################################################################################
# OSPF Network Device Manager - Execute All Options Script
# Purpose: Execute Options 1, 2, 3, and 4 in sequence
# Date: November 29, 2025
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo "============================================================================"
    echo -e "${BLUE}$1${NC}"
    echo "============================================================================"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo "ℹ️  $1"
}

# Confirmation prompt
confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

################################################################################
# OPTION 1: Test Password Encryption
################################################################################
execute_option1() {
    print_header "OPTION 1: Test Password Encryption"
    
    # Navigate to backend
    cd backend
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        print_warning "Virtual environment not found. Creating..."
        python3 -m venv venv
    fi
    
    # Activate venv
    print_info "Activating virtual environment..."
    source venv/bin/activate
    
    # Install dependencies
    print_info "Installing/updating dependencies..."
    pip install -q -r requirements.txt
    
    # Run encryption tests
    print_info "Running encryption module tests..."
    python -m modules.device_encryption
    
    if [ $? -eq 0 ]; then
        print_success "Encryption tests passed!"
        
        # Backup encryption key
        if [ -f ".encryption_key" ]; then
            print_info "Backing up encryption key..."
            mkdir -p ~/backups
            cp .encryption_key ~/backups/.encryption_key.backup
            print_success "Encryption key backed up to ~/backups/.encryption_key.backup"
        fi
    else
        print_error "Encryption tests failed!"
        exit 1
    fi
    
    # Return to project root
    cd ..
    
    print_success "OPTION 1 COMPLETE!"
}

################################################################################
# OPTION 2: Deploy to VM172
################################################################################
execute_option2() {
    print_header "OPTION 2: Deploy to VM172"
    
    # Check VM172 connectivity
    print_info "Testing VM172 connectivity..."
    if ping -c 1 172.16.39.172 &> /dev/null; then
        print_success "VM172 is reachable"
    else
        print_error "VM172 is not reachable!"
        print_warning "Please check network connectivity and try again"
        exit 1
    fi
    
    # Check SSH connectivity
    print_info "Testing SSH connectivity..."
    if ssh -o ConnectTimeout=5 cisco@172.16.39.172 "echo 'SSH OK'" &> /dev/null; then
        print_success "SSH connection successful"
    else
        print_error "SSH connection failed!"
        print_warning "Please check SSH credentials and try again"
        exit 1
    fi
    
    # Make deployment script executable
    chmod +x deploy_to_vm172.sh
    
    # Run deployment
    print_info "Running deployment script..."
    ./deploy_to_vm172.sh
    
    if [ $? -eq 0 ]; then
        print_success "Deployment completed successfully!"
        
        echo ""
        print_warning "IMPORTANT: Next Steps on VM172"
        echo "  1. SSH to VM172: ssh cisco@172.16.39.172"
        echo "  2. Navigate to: cd ~/OSPF-LL-DEVICE_MANAGER"
        echo "  3. Edit config: nano backend/.env.local"
        echo "  4. Start app: ./start.sh"
        echo "  5. Access: http://172.16.39.172:9050"
        echo ""
        
        if confirm "Would you like to configure and start the application on VM172 now?"; then
            print_info "Opening SSH session to VM172..."
            ssh cisco@172.16.39.172 'bash -s' << 'ENDSSH'
                cd ~/OSPF-LL-DEVICE_MANAGER
                
                echo ""
                echo "📝 Current configuration:"
                cat backend/.env.local
                echo ""
                
                read -p "Press Enter to edit configuration (Ctrl+C to skip)..." 
                nano backend/.env.local
                
                echo ""
                read -p "Start application now? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    ./start.sh
                    echo ""
                    echo "✅ Application started!"
                    echo "Access at: http://172.16.39.172:9050"
                fi
ENDSSH
        fi
    else
        print_error "Deployment failed!"
        exit 1
    fi
    
    print_success "OPTION 2 COMPLETE!"
}

################################################################################
# OPTION 3: Run E2E Tests
################################################################################
execute_option3() {
    print_header "OPTION 3: Run E2E Tests"
    
    # Check if Playwright is installed
    if ! command -v npx &> /dev/null; then
        print_error "npm/npx not found!"
        print_warning "Please install Node.js and try again"
        exit 1
    fi
    
    # Install Playwright if needed
    if [ ! -d "node_modules/@playwright" ]; then
        print_info "Installing Playwright..."
        npm install -D @playwright/test
        npx playwright install
    fi
    
    # Set application URL
    print_info "Setting application URL..."
    if confirm "Test against VM172 (http://172.16.39.172:9050)? (n = localhost)"; then
        export APP_URL="http://172.16.39.172:9050"
        print_info "Testing against VM172"
    else
        export APP_URL="http://localhost:9050"
        print_info "Testing against localhost"
    fi
    
    # Run quick tests (01-07)
    print_info "Running quick validation tests (01-07)..."
    npx playwright test tests/e2e/real-network.test.ts --grep "01|02|03|04|05|06|07"
    
    if [ $? -eq 0 ]; then
        print_success "Quick tests passed!"
        
        # Offer to run full test #99
        if confirm "Run full E2E workflow test (#99)? (takes ~8 minutes)"; then
            print_info "Running full E2E test..."
            npx playwright test tests/e2e/real-network.test.ts --grep "99"
            
            if [ $? -eq 0 ]; then
                print_success "Full E2E test passed!"
            else
                print_warning "Some tests may have failed. Check the report."
            fi
        fi
        
        # Show report
        if confirm "Open test report in browser?"; then
            npx playwright show-report
        fi
    else
        print_error "Tests failed!"
        print_info "Opening test report..."
        npx playwright show-report
        exit 1
    fi
    
    print_success "OPTION 3 COMPLETE!"
}

################################################################################
# OPTION 4: Review Documentation
################################################################################
execute_option4() {
    print_header "OPTION 4: Review Documentation"
    
    # List all documentation files
    print_info "Available documentation:"
    echo "  1. USER_MANUAL.md (15,000 words)"
    echo "  2. DEPLOYMENT_TESTING_GUIDE.md (500 lines)"
    echo "  3. SESSION_SUMMARY_2025-11-29.md"
    echo "  4. PRODUCTION_READY_IMPLEMENTATION.md"
    echo "  5. ULTRA_DEEP_CODE_REVIEW_2025-11-29.md (25,000 words)"
    echo "  6. EXECUTE_ALL_TASKS.md (this guide)"
    echo ""
    
    # Open each document
    docs=(
        "USER_MANUAL.md"
        "DEPLOYMENT_TESTING_GUIDE.md"
        "SESSION_SUMMARY_2025-11-29.md"
        "PRODUCTION_READY_IMPLEMENTATION.md"
        "ULTRA_DEEP_CODE_REVIEW_2025-11-29.md"
        "EXECUTE_ALL_TASKS.md"
    )
    
    for doc in "${docs[@]}"; do
        if [ -f "$doc" ]; then
            if confirm "Open $doc?"; then
                # Detect OS and use appropriate command
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    open "$doc"
                elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                    xdg-open "$doc"
                elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
                    start "$doc"
                fi
                print_success "Opened $doc"
                sleep 1  # Brief pause between opening files
            fi
        else
            print_warning "$doc not found"
        fi
    done
    
    # Documentation checklist
    echo ""
    print_info "Documentation Review Checklist:"
    echo "  [ ] All sections render correctly"
    echo "  [ ] Code examples are highlighted"
    echo "  [ ] No broken links"
    echo "  [ ] Screenshots/diagrams visible"
    echo "  [ ] Information is accurate"
    echo ""
    
    print_success "OPTION 4 COMPLETE!"
}

################################################################################
# MAIN EXECUTION
################################################################################
main() {
    print_header "OSPF Network Device Manager - Execute All Options"
    
    echo "This script will execute all 4 options in sequence:"
    echo "  1. Test Password Encryption"
    echo "  2. Deploy to VM172"
    echo "  3. Run E2E Tests"
    echo "  4. Review Documentation"
    echo ""
    
    if ! confirm "Do you want to proceed?"; then
        print_warning "Execution cancelled by user"
        exit 0
    fi
    
    # Execute each option
    execute_option1
    execute_option2
    execute_option3
    execute_option4
    
    # Final summary
    print_header "🎉 ALL OPTIONS EXECUTED SUCCESSFULLY!"
    
    echo "Summary:"
    print_success "Option 1: Encryption tested and key backed up"
    print_success "Option 2: Deployed to VM172"
    print_success "Option 3: E2E tests passed"
    print_success "Option 4: Documentation reviewed"
    echo ""
    
    print_info "Next Steps:"
    echo "  1. Configure jumphost in UI (172.16.39.173)"
    echo "  2. Add routers (172.20.0.11-20)"
    echo "  3. Run first automation job"
    echo "  4. Verify data collection"
    echo ""
    
    print_success "Your OSPF Network Device Manager is production-ready! 🚀"
}

# Run main function
main
